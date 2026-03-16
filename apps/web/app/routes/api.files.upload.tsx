import * as fs from 'fs/promises'
import * as path from 'path'
import { data, type ActionFunctionArgs } from 'react-router'
import { v4 as uuid } from 'uuid'

import { db } from '~/lib/db.server'
import { requireAuth } from '~/lib/session.server'
import { UPLOAD_DIR } from '~/lib/uploads.server'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
]

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request)
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file || !(file instanceof File)) {
    throw data({ error: 'No file uploaded' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw data(
      {
        error: 'Unsupported file type. Supported: images, PDFs, and text files.',
      },
      { status: 400 },
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    throw data({ error: 'File too large. Maximum size is 20MB.' }, { status: 400 })
  }

  const uploadPath = UPLOAD_DIR
  await fs.mkdir(uploadPath, { recursive: true })

  const ext = file.name.split('.').pop() || 'bin'
  const storedName = `${uuid()}.${ext}`
  const filePath = path.join(uploadPath, storedName)

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

  return {
    id: fileRecord.id,
    filename: fileRecord.filename,
    mimeType: fileRecord.mimeType,
    size: fileRecord.size,
  }
}
