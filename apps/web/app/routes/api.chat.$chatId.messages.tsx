import { data, type LoaderFunctionArgs } from 'react-router'

import { db } from '~/lib/db.server'
import { requireAuth } from '~/lib/session.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireAuth(request)

  const chat = await db.chat.findUnique({
    where: { id: params.chatId, userId: user.id },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          model: true,
          status: true,
          error: true,
          createdAt: true,
        },
      },
    },
  })

  if (!chat) {
    throw data({ error: 'Chat not found' }, { status: 404 })
  }

  const hasPendingMessage = chat.messages.some(
    (m: { status: string }) => m.status === 'pending' || m.status === 'processing',
  )

  return {
    messages: chat.messages,
    hasPendingMessage,
  }
}
