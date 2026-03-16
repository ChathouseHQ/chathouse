import { data, type ActionFunctionArgs } from 'react-router'
import { z } from 'zod'

import { db } from '~/lib/db.server'
import { requireAuth } from '~/lib/session.server'

const actionSchema = z.object({
  chatId: z.string().uuid(),
  action: z.enum(['pin', 'unpin', 'rename', 'delete']),
  title: z.string().min(1).max(100).optional(),
})

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request)
  const body = await request.json()

  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    throw data({ error: 'Invalid request' }, { status: 400 })
  }

  const { chatId, action: chatAction, title } = parsed.data

  const chat = await db.chat.findUnique({
    where: { id: chatId, userId: user.id },
    select: { id: true, pinned: true },
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

    default:
      throw data({ error: 'Unknown action' }, { status: 400 })
  }
}
