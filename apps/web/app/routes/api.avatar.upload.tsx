import * as fs from 'fs/promises'
import * as path from 'path'
import { data, type ActionFunctionArgs } from 'react-router'
import { v4 as uuid } from 'uuid'

import { db } from '~/lib/db.server'
import { requireAuth } from '~/lib/session.server'
import { UPLOAD_DIR } from '~/lib/uploads.server'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

function extractFileId(avatarUrl: string): string | null {
  const match = avatarUrl.match(/^\/api\/files\/(.+)$/)
  return match?.[1] ?? null
}

async function deleteOldAvatar(avatarUrl: string) {
  const fileId = extractFileId(avatarUrl)
  if (!fileId) return

  const file = await db.file.findUnique({ where: { id: fileId } })
  if (file) {
    const filePath = path.join(process.cwd(), UPLOAD_DIR, file.storedName)
    try {
      await fs.unlink(filePath)
    } catch {
      // File may already be deleted from disk
    }
    await db.file.delete({ where: { id: fileId } })
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request)
  const formData = await request.formData()

  const intent = formData.get('intent')

  if (intent === 'remove') {
    const currentUser = await db.user.findUnique({
      where: { id: user.id },
      select: { avatarUrl: true },
    })

    if (currentUser?.avatarUrl) {
      await deleteOldAvatar(currentUser.avatarUrl)
    }

    await db.user.update({
      where: { id: user.id },
      data: { avatarUrl: null },
    })

    return { success: true, avatarUrl: null }
  }

  const file = formData.get('avatar') as File | null

  if (!file || !(file instanceof File)) {
    throw data({ error: 'No file uploaded' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw data(
      { error: 'Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.' },
      { status: 400 },
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    throw data({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 })
  }

  const uploadPath = UPLOAD_DIR
  await fs.mkdir(uploadPath, { recursive: true })

  const ext = file.name.split('.').pop() || 'jpg'
  const storedName = `${uuid()}.${ext}`
  const filePath = path.join(uploadPath, storedName)

  const currentUser = await db.user.findUnique({
    where: { id: user.id },
    select: { avatarUrl: true },
  })

  if (currentUser?.avatarUrl) {
    await deleteOldAvatar(currentUser.avatarUrl)
  }

  const buffer = await file.arrayBuffer()
  await fs.writeFile(filePath, Buffer.from(buffer))

  const fileRecord = await db.file.create({
    data: {
      userId: user.id,
      filename: file.name,
      storedName,
      mimeType: file.type,
      size: file.size,
    },
  })

  const avatarUrl = `/api/files/${fileRecord.id}`

  await db.user.update({
    where: { id: user.id },
    data: { avatarUrl },
  })

  return { success: true, avatarUrl }
}
