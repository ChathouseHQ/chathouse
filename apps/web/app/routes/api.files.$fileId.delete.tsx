import * as fs from 'fs/promises'
import * as path from 'path'
import { data, type ActionFunctionArgs } from 'react-router'

import { db } from '~/lib/db.server'
import { requireAuth } from '~/lib/session.server'
import { UPLOAD_DIR } from '~/lib/uploads.server'

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireAuth(request)
  const fileId = params.fileId

  const file = await db.file.findUnique({
    where: { id: fileId, userId: user.id },
  })

  if (!file) {
    throw data({ error: 'File not found' }, { status: 404 })
  }

  const filePath = path.join(UPLOAD_DIR, file.storedName)
  try {
    await fs.unlink(filePath)
  } catch {
    // File may already be deleted from disk
  }

  await db.file.delete({ where: { id: fileId } })

  return { success: true }
}
