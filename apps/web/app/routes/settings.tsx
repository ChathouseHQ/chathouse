import {
  ArrowLeftIcon,
  CpuIcon,
  FileIcon,
  GearIcon,
  InfoIcon,
  KeyIcon,
  ListIcon,
  ShieldCheckIcon,
  UserIcon,
  XIcon,
} from '@phosphor-icons/react'
import Avatar from 'boring-avatars'
import { useState } from 'react'
import { Link, NavLink, Outlet, useLoaderData, type LoaderFunctionArgs } from 'react-router'

import { requireAuth } from '~/lib/session.server'
import { cn } from '~/lib/utils'
import { Text } from '~/ui'

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request)
  return { user }
}

const tabs = [
  {
    to: '/settings/account',
    label: 'Account',
    icon: UserIcon,
    iconColor: 'text-blue-500',
  },
  {
    to: '/settings/security',
    label: 'Security',
    icon: ShieldCheckIcon,
    iconColor: 'text-indigo-500',
  },
  {
    to: '/settings/connections',
    label: 'Connections',
    icon: KeyIcon,
    iconColor: 'text-emerald-500',
  },
  {
    to: '/settings/models',
    label: 'Models',
    icon: CpuIcon,
    iconColor: 'text-teal-500',
  },
  {
    to: '/settings/preferences',
    label: 'Preferences',
    icon: GearIcon,
    iconColor: 'text-purple-500',
  },
  {
    to: '/settings/files',
    label: 'Files',
    icon: FileIcon,
    iconColor: 'text-amber-500',
  },
  {
    to: '/settings/about',
    label: 'About',
    icon: InfoIcon,
    iconColor: 'text-stone-500',
  },
]

export default function SettingsLayout() {
  const { user } = useLoaderData<typeof loader>()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-full flex-col bg-white md:flex-row">
      <header className="border-surface-200 flex h-14 items-center gap-3 border-b bg-white px-4 md:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-surface-600 hover:bg-surface-100 rounded-md p-2"
          aria-label="Open settings menu"
        >
          <ListIcon className="h-6 w-6" />
        </button>
        <span className="text-surface-900 font-semibold">Settings</span>
      </header>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'border-surface-200 w-64 border-r bg-stone-50',
          'hidden md:block', // Desktop behaviour
          sidebarOpen && 'fixed inset-y-0 left-0 z-50 block h-full shadow-xl', // Mobile behaviour
        )}
      >
        <div className="border-surface-200 flex h-14 items-center justify-between border-b px-4">
          <Link
            to="/chat"
            className="text-surface-600 hover:text-surface-900 flex items-center gap-2"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            <span className="font-medium">Back to Chat</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-surface-500 hover:bg-surface-100 rounded-md p-1 md:hidden"
            aria-label="Close menu"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || user.email}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Avatar
                  size={48}
                  name={user.id}
                  variant="beam"
                  colors={['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899']}
                />
              )}
            </div>
            <div className="min-w-0">
              <Text as="p" weight="medium" truncate>
                {user.name || 'User'}
              </Text>
              <Text as="p" size="sm" colour="muted" truncate>
                {user.email}
              </Text>
            </div>
          </div>

          <nav className="flex flex-col space-y-0.5">
            {tabs.map((tab) => {
              const Icon = tab.icon

              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center rounded-md px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-surface-200 text-surface-900 font-semibold'
                        : 'text-surface-600 hover:bg-surface-200 hover:text-surface-900',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={cn(
                          'mr-2 size-4 shrink-0 transition-colors',
                          isActive ? 'text-surface-900' : 'text-surface-600',
                        )}
                      />
                      <span className="truncate">{tab.label}</span>
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
