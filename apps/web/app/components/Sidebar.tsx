import {
  DiscordLogoIcon,
  BookmarkSimpleIcon,
  CaretUpIcon,
  ChatCircleDotsIcon,
  DotsThreeVerticalIcon,
  FileTextIcon,
  GearIcon,
  GithubLogoIcon,
  PencilSimpleIcon,
  PlusIcon,
  SidebarSimpleIcon,
  SignOutIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import Avatar from 'boring-avatars'
import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Form,
  Link,
  NavLink,
  useFetcher,
  useLocation,
  useNavigate,
  useRevalidator,
} from 'react-router'

import { performChatAction } from '~/lib/chat-actions'
import { cn } from '~/lib/utils'
import { Logo, Text } from '~/ui'

interface Chat {
  id: string
  title: string
  pinned: boolean
  updatedAt: string | Date
}

interface User {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
}

interface SidebarProps {
  user: User
  chats: Chat[]
  hasMoreChats: boolean
  className?: string
  onClose?: () => void
}

const sidebarSocialLinks = [
  {
    href: '/discord',
    label: 'Discord',
    icon: DiscordLogoIcon,
    iconClassName: 'text-[#5865F2]',
    hoverClassName: 'hover:border-[#5865F2]/20 hover:bg-[#5865F2]/10',
  },
  {
    href: 'https://github.com/ChathouseHQ/chathouse',
    label: 'GitHub',
    icon: GithubLogoIcon,
    iconClassName: 'text-[#24292f]',
    hoverClassName: 'hover:border-slate-900/10 hover:bg-slate-900/5',
  },
] as const

function getTimeBucket(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  if (d >= today) return 'Today'
  if (d >= yesterday) return 'Yesterday'
  if (d >= weekAgo) return 'Previous 7 days'
  if (d >= monthAgo) return 'Previous 30 days'

  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString('en-US', { month: 'long' })
  }

  return d.getFullYear().toString()
}

function groupChatsByTime(chats: Chat[]): Map<string, Chat[]> {
  const groups = new Map<string, Chat[]>()
  const pinnedChats = chats.filter((c) => c.pinned)
  const unpinnedChats = chats.filter((c) => !c.pinned)

  if (pinnedChats.length > 0) {
    groups.set('Pinned', pinnedChats)
  }

  for (const chat of unpinnedChats) {
    const bucket = getTimeBucket(chat.updatedAt)
    const existing = groups.get(bucket) || []
    existing.push(chat)
    groups.set(bucket, existing)
  }

  return groups
}

function ChatMenu({
  chat,
  isOpen,
  onClose,
  position,
  isCurrentChat,
}: {
  chat: Chat
  isOpen: boolean
  onClose: () => void
  position: { x: number; y: number }
  isCurrentChat: boolean
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const [isRenaming, setIsRenaming] = useState(false)
  const [newTitle, setNewTitle] = useState(chat.title)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const renameInFlightRef = useRef(false)

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleAction = async (action: 'pin' | 'unpin' | 'delete') => {
    if (isSubmitting) return

    if (action === 'delete') {
      if (!confirm('Are you sure you want to delete this chat?')) {
        onClose()
        return
      }
    }

    setIsSubmitting(true)

    try {
      await performChatAction({ chatId: chat.id, action })

      if (action === 'delete' && isCurrentChat) {
        navigate('/chat')
      }

      revalidator.revalidate()
      onClose()
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "Couldn't update chat. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRename = async () => {
    if (renameInFlightRef.current) return

    if (!newTitle.trim() || newTitle === chat.title) {
      setIsRenaming(false)
      setNewTitle(chat.title)
      return
    }

    renameInFlightRef.current = true
    setIsSubmitting(true)

    try {
      await performChatAction({
        chatId: chat.id,
        action: 'rename',
        title: newTitle.trim(),
      })

      revalidator.revalidate()
      setIsRenaming(false)
      onClose()
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "Couldn't update chat. Please try again.")
      inputRef.current?.focus()
    } finally {
      renameInFlightRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <div
      ref={menuRef}
      className="ring-surface-200 fixed z-50 min-w-[160px] rounded-md bg-white p-1 shadow-lg ring-1"
      style={{ top: position.y, left: position.x }}
    >
      {isRenaming ? (
        <div className="px-1 py-1">
          <input
            ref={inputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleRename()
              }
              if (e.key === 'Escape') {
                setIsRenaming(false)
                setNewTitle(chat.title)
              }
            }}
            onBlur={handleRename}
            disabled={isSubmitting}
            className="border-surface-300 focus:border-surface-500 w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none"
          />
        </div>
      ) : (
        <>
          <button
            onClick={() => handleAction(chat.pinned ? 'unpin' : 'pin')}
            disabled={isSubmitting}
            className="text-surface-700 hover:bg-surface-100 flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm font-medium transition-colors"
          >
            <BookmarkSimpleIcon className="h-4 w-4" />
            {chat.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            onClick={() => setIsRenaming(true)}
            disabled={isSubmitting}
            className="text-surface-700 hover:bg-surface-100 flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm font-medium transition-colors"
          >
            <PencilSimpleIcon className="h-4 w-4" />
            Rename
          </button>
          <div className="border-surface-100 my-0.5 border-t" />
          <button
            onClick={() => handleAction('delete')}
            disabled={isSubmitting}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <TrashIcon className="h-4 w-4" />
            Delete
          </button>
        </>
      )}
    </div>
  )
}

export function UserMenu({
  user,
  isOpen,
  onClose,
  anchorRef,
  className,
}: {
  user: User
  isOpen: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLButtonElement | null>
  className?: string
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ bottom: number; left: number; width: number } | null>(
    null,
  )

  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setPosition({
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
        width: rect.width,
      })
    }
  }, [isOpen, anchorRef])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, anchorRef])

  if (!isOpen || !position) return null

  return (
    <div
      ref={menuRef}
      className={cn(
        'ring-surface-200 fixed z-50 min-w-[200px] rounded-md bg-white p-1 shadow-lg ring-1',
        className,
      )}
      style={{ bottom: position.bottom, left: position.left, width: position.width }}
    >
      <div className="border-surface-100 border-b px-2 py-2">
        <Text as="span" size="xs" colour="muted" className="block">
          Signed in as
        </Text>
        <Text
          as="span"
          size="sm"
          weight="medium"
          colour="secondary"
          truncate
          className="mt-0.5 block"
        >
          {user.email}
        </Text>
      </div>
      <div className="py-1">
        <Link
          to="/settings"
          onClick={onClose}
          className="text-surface-700 hover:bg-surface-100 flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-colors"
        >
          <GearIcon className="h-4 w-4" />
          Settings
        </Link>
        <a
          href="https://chathou.se/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="text-surface-700 hover:bg-surface-100 flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-colors"
        >
          <FileTextIcon className="h-4 w-4" />
          Docs
        </a>
      </div>
      <div className="border-surface-100 border-t py-1">
        <Form method="post" action="/logout">
          <button
            type="submit"
            className="text-surface-700 hover:bg-surface-100 flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm font-medium transition-colors"
          >
            <SignOutIcon className="h-4 w-4" />
            Log out
          </button>
        </Form>
      </div>
    </div>
  )
}

function ChatItem({ chat, isActive }: { chat: Chat; isActive: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleMenuClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) {
      setMenuPosition({ x: rect.right + 4, y: rect.top })
    }
    setMenuOpen(true)
  }

  return (
    <>
      <NavLink
        to={`/chat/${chat.id}`}
        className={cn(
          'group relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
          isActive
            ? 'bg-surface-200 text-surface-900'
            : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900',
        )}
      >
        {chat.pinned && (
          <BookmarkSimpleIcon className="h-3 w-3 shrink-0 text-amber-500" weight="fill" />
        )}
        <span className="flex-1 truncate">{chat.title}</span>
        <button
          ref={buttonRef}
          onClick={handleMenuClick}
          className={cn(
            'text-surface-400 hover:bg-surface-200 hover:text-surface-600 shrink-0 rounded p-0.5 transition-opacity',
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          <DotsThreeVerticalIcon className="h-4 w-4" weight="bold" />
        </button>
      </NavLink>
      <ChatMenu
        chat={chat}
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        position={menuPosition}
        isCurrentChat={isActive}
      />
    </>
  )
}

export function Sidebar({
  user,
  chats: initialChats,
  hasMoreChats: initialHasMore,
  className,
  onClose,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showContent, setShowContent] = useState(true)
  const [chatsVisible, setChatsVisible] = useState(true)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [allChats, setAllChats] = useState<Chat[]>(initialChats)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [sentinelNode, setSentinelNode] = useState<HTMLDivElement | null>(null)
  const userButtonRef = useRef<HTMLButtonElement>(null)
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const scrollContainerRef = useRef<HTMLElement>(null)
  const lastCursorRef = useRef<string | null>(null)
  const location = useLocation()
  const fetcher = useFetcher<{ chats: Chat[]; hasMore: boolean }>()

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
          fetcherRef.current.load(`/api/chats?cursor=${lastId}&limit=50`)
        }
      },
      { root: scrollContainerRef.current, rootMargin: '200px' },
    )

    observer.observe(sentinelNode)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentinelNode, hasMore, allChats.length])

  const groupedChats = useMemo(() => groupChatsByTime(allChats), [allChats])
  const currentChatId = location.pathname.match(/\/chat\/([^/]+)/)?.[1]

  useEffect(() => {
    if (!onClose) return
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
    }
  }, [])

  const handleToggleCollapse = () => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = null
    }

    if (isCollapsed) {
      setShowContent(true)
      setIsCollapsed(false)
    } else {
      setIsCollapsed(true)
      collapseTimerRef.current = setTimeout(() => {
        setShowContent(false)
        collapseTimerRef.current = null
      }, 200)
    }
  }

  return (
    <>
      {onClose && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'sidebar-transition border-surface-200 flex h-full flex-col overflow-hidden border-r bg-stone-50',
          isCollapsed && !onClose ? 'w-16' : 'w-64',
          className,
        )}
      >
        <div
          className={cn(
            'flex items-center justify-between py-3',
            !showContent && !onClose ? 'justify-center px-2' : 'px-3',
          )}
        >
          {showContent && <Logo />}
          {!onClose && (
            <button
              onClick={handleToggleCollapse}
              className={cn(
                'text-surface-500 hover:bg-surface-200 hover:text-surface-900 rounded-md p-1.5 transition-colors',
                !showContent && 'mx-auto',
              )}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <SidebarSimpleIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1 px-2 pb-2">
          <Link
            to="/chat"
            className={cn(
              'text-surface-700 hover:bg-surface-200 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
              !showContent && !onClose && 'justify-center px-0',
            )}
          >
            <PlusIcon className="h-5 w-5 shrink-0" />
            {(showContent || onClose) && <span className="whitespace-nowrap">New chat</span>}
          </Link>

          <NavLink
            to="/chats"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-surface-200 text-surface-900'
                  : 'text-surface-700 hover:bg-surface-200',
                !showContent && !onClose && 'justify-center px-0',
              )
            }
          >
            <ChatCircleDotsIcon className="h-5 w-5 shrink-0" />
            {(showContent || onClose) && <span>Chats</span>}
          </NavLink>
        </div>

        <div className="border-surface-200 mx-2 border-t" />

        {(showContent || onClose) && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <button
              onClick={() => setChatsVisible(!chatsVisible)}
              className="group hover:bg-surface-100 flex w-full items-center justify-between px-4 py-2 text-left transition-colors"
            >
              <Text
                as="span"
                size="xs"
                weight="medium"
                colour="muted"
                tracking="wide"
                className="whitespace-nowrap uppercase"
              >
                Your chats
              </Text>
              <Text
                as="span"
                size="xs"
                colour="muted"
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                {chatsVisible ? 'Hide' : 'Show'}
              </Text>
            </button>

            {chatsVisible && (
              <nav
                ref={scrollContainerRef}
                className="flex-1 overflow-x-hidden overflow-y-auto px-2 pb-2"
              >
                {allChats.length === 0 ? (
                  <Text as="p" size="sm" colour="muted" className="py-4 text-center">
                    No chats yet
                  </Text>
                ) : (
                  <>
                    <div className="space-y-3">
                      {Array.from(groupedChats.entries()).map(([bucket, bucketChats]) => (
                        <div key={bucket}>
                          <Text
                            as="p"
                            size="xs"
                            weight="semibold"
                            colour="secondary"
                            className="mt-2 mb-1 px-2"
                          >
                            {bucket}
                          </Text>
                          <ul className="space-y-0.5">
                            {bucketChats.map((chat) => (
                              <li key={chat.id}>
                                <ChatItem chat={chat} isActive={currentChatId === chat.id} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    {hasMore && (
                      <div ref={setSentinelNode} className="flex justify-center py-3">
                        {fetcher.state !== 'idle' && (
                          <div className="border-surface-300 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                        )}
                      </div>
                    )}
                  </>
                )}
              </nav>
            )}
          </div>
        )}

        {!showContent && !onClose && <div className="flex-1" />}

        <div className="border-surface-200 space-y-2 border-t p-2">
          <div
            className={cn('grid gap-2', !showContent && !onClose ? 'grid-cols-1' : 'grid-cols-2')}
          >
            {sidebarSocialLinks.map(
              ({ href, label, icon: Icon, iconClassName, hoverClassName }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={label}
                  aria-label={label}
                  className={cn(
                    'border-surface-200 text-surface-700 flex items-center justify-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-medium transition-colors',
                    hoverClassName,
                    !showContent && !onClose ? 'px-0' : 'justify-start',
                  )}
                >
                  <Icon className={cn('h-5 w-5 shrink-0', iconClassName)} weight="fill" />
                  {(showContent || onClose) && <span className="whitespace-nowrap">{label}</span>}
                </a>
              ),
            )}
          </div>
          <div className="relative">
            <UserMenu
              user={user}
              isOpen={userMenuOpen}
              onClose={() => setUserMenuOpen(false)}
              anchorRef={userButtonRef}
            />
            <button
              ref={userButtonRef}
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={cn(
                'hover:bg-surface-200 flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors',
                !showContent && !onClose && 'justify-center px-0',
              )}
            >
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name || user.email}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Avatar
                    size={32}
                    name={user.id}
                    variant="beam"
                    colors={['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899']}
                  />
                )}
              </div>

              {(showContent || onClose) && (
                <>
                  <div className="min-w-0 flex-1">
                    <Text as="p" size="sm" weight="medium" colour="primary" truncate>
                      {user.name || user.email}
                    </Text>
                  </div>
                  <CaretUpIcon
                    className={cn(
                      'text-surface-400 h-4 w-4 shrink-0 transition-transform',
                      userMenuOpen && 'rotate-180',
                    )}
                  />
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
