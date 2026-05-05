import { isReasoningLevel } from '@chathouse/database'
import { data, type ActionFunctionArgs } from 'react-router'

import { db } from '~/lib/db.server'
import { addChatJob, addTitleJob } from '~/lib/queue.server'
import { requireAuth } from '~/lib/session.server'

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request)
  const body = await request.json()

  const { content, model, chatId } = body
  const reasoningEffort = isReasoningLevel(body.reasoningEffort) ? body.reasoningEffort : undefined

  if (!content?.trim()) {
    throw data({ error: 'Message cannot be empty' }, { status: 400 })
  }

  if (!model) {
    throw data({ error: 'Model is required' }, { status: 400 })
  }

  const settings = await db.userSettings.findUnique({
    where: { userId: user.id },
    select: {
      systemPrompt: true,
      titleStrategy: true,
    },
  })

  let chat
  let isNewChat = false

  if (chatId) {
    chat = await db.chat.findUnique({
      where: { id: chatId, userId: user.id },
    })

    if (!chat) {
      throw data({ error: 'Chat not found' }, { status: 404 })
    }
  } else {
    chat = await db.chat.create({
      data: {
        userId: user.id,
        title: 'New Chat',
      },
    })
    isNewChat = true
  }

  await db.message.create({
    data: {
      chatId: chat.id,
      role: 'user',
      content: content.trim(),
      status: 'complete',
    },
  })

  const assistantMessage = await db.message.create({
    data: {
      chatId: chat.id,
      role: 'assistant',
      content: '',
      model,
      status: 'pending',
    },
  })

  await db.chat.update({
    where: { id: chat.id },
    data: { updatedAt: new Date() },
  })

  await addChatJob({
    messageId: assistantMessage.id,
    chatId: chat.id,
    userId: user.id,
    content: content.trim(),
    model,
    systemPrompt: settings?.systemPrompt || undefined,
    reasoningEffort,
  })

  if (isNewChat) {
    await addTitleJob({
      chatId: chat.id,
      userId: user.id,
      firstMessage: content.trim(),
      strategy: (settings?.titleStrategy as 'ai' | 'first_chars') || 'ai',
    })
  }

  return {
    success: true,
    chatId: chat.id,
    messageId: assistantMessage.id,
  }
}
