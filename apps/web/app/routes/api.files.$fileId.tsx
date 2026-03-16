import * as fs from 'fs/promises'
import * as path from 'path'
import { data, type LoaderFunctionArgs } from 'react-router'

import { db } from '~/lib/db.server'
import { getSession } from '~/lib/session.server'
import { UPLOAD_DIR } from '~/lib/uploads.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getSession(request)
  const fileId = params.fileId

  const file = await db.file.findUnique({
    where: { id: fileId },
    include: {
      message: {
        select: {
          chat: {
            select: {
              userId: true,
              sharedLinks: {
                where: { includeAttachments: true },
                select: { id: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  })

  if (!file) {
    throw data({ error: 'File not found' }, { status: 404 })
  }

  const isOwner = user?.id === file.userId
  const hasSharedLinkWithAttachments = (file.message?.chat?.sharedLinks?.length ?? 0) > 0

  if (!isOwner && !hasSharedLinkWithAttachments) {
    const isAvatar = await db.user.findFirst({
      where: { avatarUrl: `/api/files/${fileId}` },
      select: { id: true },
    })

    if (!isAvatar) {
      throw data({ error: 'Unauthorized' }, { status: 403 })
    }
  }

  const filePath = path.join(UPLOAD_DIR, file.storedName)

  let fileBuffer: Buffer
  try {
    fileBuffer = await fs.readFile(filePath)
  } catch {
    throw data({ error: 'File not found on disk' }, { status: 404 })
  }

  const SAFE_INLINE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
  ]
  const canInline = SAFE_INLINE_TYPES.includes(file.mimeType)
  const disposition = canInline ? 'inline' : 'attachment'

  const headers: Record<string, string> = {
    'Content-Type': canInline ? file.mimeType : 'application/octet-stream',
    'Content-Disposition': `${disposition}; filename="${encodeURIComponent(file.filename)}"`,
    'Cache-Control': 'private, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  }

  if (!canInline) {
    headers['Content-Security-Policy'] = 'sandbox'
  }

  return new Response(new Uint8Array(fileBuffer), { headers })
}
