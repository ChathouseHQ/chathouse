import { nanoid } from 'nanoid'
import { data, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'

import { db } from '~/lib/db.server'
import { requireAuth } from '~/lib/session.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireAuth(request)

  const chat = await db.chat.findUnique({
    where: { id: params.chatId, userId: user.id },
    select: { id: true },
  })

  if (!chat) {
    throw data({ error: 'Chat not found' }, { status: 404 })
  }

  const sharedLinks = await db.sharedLink.findMany({
    where: { chatId: chat.id },
    orderBy: { createdAt: 'desc' },
  })

  return { sharedLinks }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireAuth(request)
  const body = await request.json()

  const chat = await db.chat.findUnique({
    where: { id: params.chatId, userId: user.id },
    select: { id: true },
  })

  if (!chat) {
    throw data({ error: 'Chat not found' }, { status: 404 })
  }

  const { intent } = body

  if (intent === 'create') {
    const link = await db.sharedLink.create({
      data: {
        id: nanoid(10),
        chatId: chat.id,
      },
    })
    return { sharedLink: link }
  }

  if (intent === 'update') {
    const { linkId, autoUpdate, includeAttachments } = body

    const existing = await db.sharedLink.findUnique({
      where: { id: linkId, chatId: chat.id },
    })

    if (!existing) {
      throw data({ error: 'Link not found' }, { status: 404 })
    }

    const updateData: {
      autoUpdate?: boolean
      includeAttachments?: boolean
      frozenAt?: Date | null
    } = {}

    if (typeof autoUpdate === 'boolean') {
      updateData.autoUpdate = autoUpdate
      updateData.frozenAt = autoUpdate ? null : new Date()
    }

    if (typeof includeAttachments === 'boolean') {
      updateData.includeAttachments = includeAttachments
    }

    const link = await db.sharedLink.update({
      where: { id: linkId },
      data: updateData,
    })

    return { sharedLink: link }
  }

  if (intent === 'delete') {
    const { linkId } = body

    await db.sharedLink.deleteMany({
      where: { id: linkId, chatId: chat.id },
    })

    return { success: true }
  }

  throw data({ error: 'Invalid intent' }, { status: 400 })
}
