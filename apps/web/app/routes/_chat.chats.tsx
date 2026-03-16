import {
  ChatCircleDotsIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  PushPinIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Link,
  useFetcher,
  useLoaderData,
  useNavigate,
  useRevalidator,
  type LoaderFunctionArgs,
} from 'react-router'

import { performChatAction } from '~/lib/chat-actions'
import { db } from '~/lib/db.server'
import { requireAuth } from '~/lib/session.server'
import { Input, Text } from '~/ui'

export function meta() {
  return [{ title: 'Chats - Chathouse' }]
}

const PAGE_SIZE = 50

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request)

  const [totalCount, chatsResult] = await Promise.all([
    db.chat.count({ where: { userId: user.id, isTemporary: false } }),
    db.chat.findMany({
      where: { userId: user.id, isTemporary: false },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        title: true,
        pinned: true,
        updatedAt: true,
        createdAt: true,
        _count: { select: { messages: true } },
      },
      take: PAGE_SIZE + 1,
    }),
  ])

  const hasMore = chatsResult.length > PAGE_SIZE
  const chats = hasMore ? chatsResult.slice(0, PAGE_SIZE) : chatsResult

  return { chats, hasMore, totalCount }
}

function formatRelativeDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

type ChatEntry = (typeof loader extends (...args: any) => Promise<infer R>
  ? R
  : never)['chats'][number]

export default function ChatsPage() {
  const {
    chats: initialChats,
    hasMore: initialHasMore,
    totalCount,
  } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const [searchQuery, setSearchQuery] = useState('')
  const [allChats, setAllChats] = useState<ChatEntry[]>(initialChats)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [sentinelNode, setSentinelNode] = useState<HTMLDivElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastCursorRef = useRef<string | null>(null)
  const fetcher = useFetcher<{ chats: ChatEntry[]; hasMore: boolean }>()

  const allChatsRef = useRef(allChats)
  allChatsRef.current = allChats
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    setAllChats(initialChats)
    setHasMore(initialHasMore)
    lastCursorRef.current = null
  }, [initialChats, initialHasMore])

  useEffect(() => {
    if (fetcher.data) {
      setAllChats((prev) => {
        const ids = new Set(prev.map((c) => c.id))
        return [...prev, ...fetcher.data!.chats.filter((c) => !ids.has(c.id))]
      })
      setHasMore(fetcher.data.hasMore)
    }
  }, [fetcher.data])

  useEffect(() => {
    if (!sentinelNode || !hasMore) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || fetcherRef.current.state !== 'idle') return
        const chats = allChatsRef.current
        const lastId = chats[chats.length - 1]?.id
        if (lastId && lastId !== lastCursorRef.current) {
          lastCursorRef.current = lastId
          fetcherRef.current.load(`/api/chats?cursor=${lastId}&limit=${PAGE_SIZE}`)
        }
      },
      { root: scrollContainerRef.current, rootMargin: '200px' },
    )

    observer.observe(sentinelNode)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentinelNode, hasMore, allChats.length])

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return allChats
    const query = searchQuery.toLowerCase()
    return allChats.filter((chat) => chat.title.toLowerCase().includes(query))
  }, [allChats, searchQuery])

  const handleDeleteChat = async (chatId: string) => {
    if (!confirm('Are you sure you want to delete this chat?')) return

    try {
      await performChatAction({ chatId, action: 'delete' })
      revalidator.revalidate()
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "Couldn't delete chat. Please try again.")
    }
  }

  return (
    <div className="bg-surface-50 flex h-full flex-col">
      <header className="border-surface-200 flex items-center justify-between border-b bg-white px-6 py-4">
        <Text as="h1" size="2xl" weight="semibold" colour="primary">
          Chats
        </Text>
        <Link
          to="/chat"
          className="bg-surface-900 hover:bg-surface-800 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          New chat
        </Link>
      </header>

      <div className="border-surface-200 border-b bg-white px-6 py-3">
        <Input
          icon={<MagnifyingGlassIcon className="h-4 w-4" />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search your chats..."
          className="border-surface-200 bg-surface-50 focus:border-surface-400 focus:ring-surface-400 text-sm focus:ring-1"
        />
        <Text as="p" size="sm" colour="muted" className="mt-2">
          {searchQuery
            ? `${filteredChats.length} matching "${searchQuery}"`
            : `${totalCount} chats with AI`}
        </Text>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <ChatCircleDotsIcon className="text-surface-300 h-12 w-12" />
            <Text as="p" colour="muted" className="mt-4">
              {searchQuery ? 'No chats found matching your search' : 'No chats yet'}
            </Text>
            {!searchQuery && (
              <Link
                to="/chat"
                className="text-surface-700 hover:text-surface-900 mt-4 text-sm font-medium"
              >
                Start a new conversation →
              </Link>
            )}
          </div>
        ) : (
          <>
            <ul className="divide-surface-100 divide-y">
              {filteredChats.map((chat) => (
                <li
                  key={chat.id}
                  className="group hover:bg-surface-50 flex items-center gap-4 bg-white px-6 py-4 transition-colors"
                >
                  <button
                    onClick={() => navigate(`/chat/${chat.id}`)}
                    className="flex flex-1 items-start gap-4 text-left"
                  >
                    <div className="bg-surface-100 text-surface-500 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                      {chat.pinned ? (
                        <PushPinIcon className="h-5 w-5 text-amber-500" weight="fill" />
                      ) : (
                        <ChatCircleDotsIcon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Text as="p" weight="medium" colour="primary" truncate>
                        {chat.title}
                      </Text>
                      <Text as="p" size="sm" colour="muted" className="mt-0.5">
                        {chat._count.messages} messages · {formatRelativeDate(chat.updatedAt)}
                      </Text>
                    </div>
                  </button>
                  <button
                    onClick={() => handleDeleteChat(chat.id)}
                    className="text-surface-400 rounded-lg p-2 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
                    title="Delete chat"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
            {hasMore && (
              <div ref={setSentinelNode} className="flex justify-center py-6">
                {fetcher.state !== 'idle' && (
                  <div className="border-surface-300 h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
