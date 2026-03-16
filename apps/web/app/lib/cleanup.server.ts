import * as fs from 'fs/promises'
import * as path from 'path'

import { db } from './db.server'
import { UPLOAD_DIR } from './uploads.server'
const TEMP_CHAT_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // run at most every 5 minutes

let lastCleanupAt = 0

export async function cleanupTemporaryChats(userId: string) {
  const now = Date.now()
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return
  lastCleanupAt = now

  try {
    const cutoff = new Date(now - TEMP_CHAT_TTL_MS)

    const expiredChats = await db.chat.findMany({
      where: {
        userId,
        isTemporary: true,
        createdAt: { lt: cutoff },
      },
      select: { id: true },
    })

    if (expiredChats.length === 0) return

    const chatIds = expiredChats.map((c) => c.id)

    const files = await db.file.findMany({
      where: {
        message: { chatId: { in: chatIds } },
      },
      select: { id: true, storedName: true },
    })

    const uploadPath = UPLOAD_DIR
    await Promise.allSettled(files.map((f) => fs.unlink(path.join(uploadPath, f.storedName))))

    if (files.length > 0) {
      await db.file.deleteMany({
        where: { id: { in: files.map((f) => f.id) } },
      })
    }

    // Delete chats (messages cascade via onDelete: Cascade)
    await db.chat.deleteMany({
      where: { id: { in: chatIds } },
    })
  } catch {
    // Cleanup is best-effort; don't break the page load
  }
}
