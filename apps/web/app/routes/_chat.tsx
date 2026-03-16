import { ListIcon, PlusIcon } from '@phosphor-icons/react'
import Avatar from 'boring-avatars'
import { useState, useRef } from 'react'
import { Link, Outlet, useLoaderData, type LoaderFunctionArgs } from 'react-router'

import { Sidebar, UserMenu } from '~/components/Sidebar'
import { cleanupTemporaryChats } from '~/lib/cleanup.server'
import { db } from '~/lib/db.server'
import { requireAuth } from '~/lib/session.server'
import { cn } from '~/lib/utils'

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request)

  const userData = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
    },
  })

  // Best-effort cleanup of expired temporary chats (throttled, non-blocking)
  cleanupTemporaryChats(user.id).catch(() => {})

  const SIDEBAR_PAGE_SIZE = 50

  const chatsResult = await db.chat.findMany({
    where: { userId: user.id, isTemporary: false },
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      pinned: true,
      updatedAt: true,
    },
    take: SIDEBAR_PAGE_SIZE + 1,
  })

  const hasMoreChats = chatsResult.length > SIDEBAR_PAGE_SIZE
  const chats = hasMoreChats ? chatsResult.slice(0, SIDEBAR_PAGE_SIZE) : chatsResult

  return { user: userData!, chats, hasMoreChats }
}

export default function ChatLayout() {
  const { user, chats, hasMoreChats } = useLoaderData<typeof loader>()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userButtonRef = useRef<HTMLButtonElement>(null)

  return (
    <div className="flex h-full flex-col md:flex-row">
      <header className="border-surface-200 flex h-14 items-center justify-between border-b bg-white px-4 md:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-surface-600 hover:bg-surface-100 rounded-md p-2"
            aria-label="Open sidebar"
          >
            <ListIcon className="h-6 w-6" />
          </button>
          <Link
            to="/chat"
            className="bg-primary-600 hover:bg-primary-700 flex items-center justify-center rounded-md p-2 text-white"
            aria-label="New chat"
          >
            <PlusIcon className="h-5 w-5" />
          </Link>
        </div>

        <div className="relative">
          <UserMenu
            user={user}
            isOpen={userMenuOpen}
            onClose={() => setUserMenuOpen(false)}
            anchorRef={userButtonRef}
            className="top-full right-0 bottom-auto left-auto mt-2 w-48"
          />
          <button
            ref={userButtonRef}
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="hover:ring-primary-200 flex items-center justify-center overflow-hidden rounded-full ring-2 ring-transparent transition-all"
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || user.email}
                className="h-8 w-8 object-cover"
              />
            ) : (
              <Avatar
                size={32}
                name={user.id}
                variant="beam"
                colors={['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899']}
              />
            )}
          </button>
        </div>
      </header>

      <Sidebar
        user={user}
        chats={chats}
        hasMoreChats={hasMoreChats}
        className={cn('hidden md:flex', sidebarOpen && 'fixed inset-y-0 left-0 z-50 flex w-64')}
        onClose={sidebarOpen ? () => setSidebarOpen(false) : undefined}
      />

      <main className="flex flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
