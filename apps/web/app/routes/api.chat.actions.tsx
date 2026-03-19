import type { Prisma } from '@chathouse/database'

import crypto from 'node:crypto'
import { data, type ActionFunctionArgs } from 'react-router'
import { z } from 'zod'

import { db } from '~/lib/db.server'
import { requireAuth } from '~/lib/session.server'

const actionSchema = z.object({
  chatId: z.string().uuid(),
  action: z.enum(['pin', 'unpin', 'rename', 'delete', 'branch']),
  title: z.string().min(1).max(100).optional(),
  messageId: z.string().uuid().optional(),
})

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request)
  const body = await request.json()

  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    throw data({ error: 'Invalid request' }, { status: 400 })
  }

  const { chatId, action: chatAction, title, messageId } = parsed.data

  const chat = await db.chat.findUnique({
    where: { id: chatId, userId: user.id },
    select: { id: true, pinned: true, title: true },
  })

  if (!chat) {
    throw data({ error: 'Chat not found' }, { status: 404 })
  }

  switch (chatAction) {
    case 'pin':
      await db.chat.update({
        where: { id: chatId },
        data: { pinned: true },
      })
      return { success: true, pinned: true }

    case 'unpin':
      await db.chat.update({
        where: { id: chatId },
        data: { pinned: false },
      })
      return { success: true, pinned: false }

    case 'rename':
      if (!title) {
        throw data({ error: 'Title is required for rename' }, { status: 400 })
      }
      await db.chat.update({
        where: { id: chatId },
        data: { title },
      })
      return { success: true, title }

    case 'delete':
      await db.chat.delete({
        where: { id: chatId },
      })
      return { success: true, deleted: true }

    case 'branch': {
      if (!messageId) {
        throw data({ error: 'messageId is required for branch' }, { status: 400 })
      }

      const newChat = await db.$transaction(async (tx: Prisma.TransactionClient) => {
        const messages = await tx.message.findMany({
          where: { chatId },
          orderBy: { createdAt: 'asc' },
          include: {
            files: {
              select: { id: true, filename: true, storedName: true, mimeType: true, size: true },
            },
          },
        })

        const targetIndex = messages.findIndex((m: { id: string }) => m.id === messageId)
        if (targetIndex === -1) {
          throw data({ error: 'Message not found in chat' }, { status: 404 })
        }

        const messagesToCopy = messages.slice(0, targetIndex + 1)

        const createdChat = await tx.chat.create({
          data: {
            userId: user.id,
            title: chat.title,
            branchedFromId: chatId,
          },
        })

        for (const msg of messagesToCopy) {
          const newMessageId = crypto.randomUUID()
          await tx.message.create({
            data: {
              id: newMessageId,
              chatId: createdChat.id,
              role: msg.role,
              content: msg.content,
              model: msg.model,
              status: 'complete',
              error: null,
              createdAt: msg.createdAt,
            },
          })

          if (msg.files.length > 0) {
            await tx.file.createMany({
              data: msg.files.map(
                (f: { filename: string; storedName: string; mimeType: string; size: number }) => ({
                  userId: user.id,
                  messageId: newMessageId,
                  filename: f.filename,
                  storedName: f.storedName,
                  mimeType: f.mimeType,
                  size: f.size,
                }),
              ),
            })
          }
        }

        return createdChat
      })

      return { success: true, chatId: newChat.id }
    }

    default:
      throw data({ error: 'Unknown action' }, { status: 400 })
  }
}
