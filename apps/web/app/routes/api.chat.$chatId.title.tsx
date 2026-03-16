import { data, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'

import { db } from '~/lib/db.server'
import { requireAuth } from '~/lib/session.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireAuth(request)

  const chat = await db.chat.findUnique({
    where: { id: params.chatId, userId: user.id },
    select: {
      id: true,
      title: true,
    },
  })

  if (!chat) {
    throw data({ error: 'Chat not found' }, { status: 404 })
  }

  return { chat }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireAuth(request)
  const body = await request.json()

  const chat = await db.chat.findUnique({
    where: { id: params.chatId, userId: user.id },
  })

  if (!chat) {
    throw data({ error: 'Chat not found' }, { status: 404 })
  }

  const { title } = body

  const updateData: { title?: string } = {}

  if (typeof title === 'string') {
    updateData.title = title.trim() || 'Untitled'
  }

  const updatedChat = await db.chat.update({
    where: { id: params.chatId },
    data: updateData,
    select: {
      id: true,
      title: true,
    },
  })

  return { chat: updatedChat }
}
