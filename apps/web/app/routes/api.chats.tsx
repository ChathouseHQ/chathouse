import type { LoaderFunctionArgs } from 'react-router'

import { db } from '~/lib/db.server'
import { requireAuth } from '~/lib/session.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request)
  const url = new URL(request.url)
  const cursor = url.searchParams.get('cursor')
  const limit = Math.min(Number(url.searchParams.get('limit') || '50'), 100)

  const chats = await db.chat.findMany({
    where: { userId: user.id, isTemporary: false },
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      pinned: true,
      updatedAt: true,
      createdAt: true,
      branchedFromId: true,
      _count: { select: { messages: true } },
    },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = chats.length > limit
  if (hasMore) chats.pop()

  return { chats, hasMore }
}
