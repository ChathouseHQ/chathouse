import { ChatCircleIcon } from '@phosphor-icons/react'
import { Link, useLoaderData, type LoaderFunctionArgs, type MetaFunction } from 'react-router'

import type { WebSearchActivity } from '~/lib/web-searches'

import { ChatMessage } from '~/components/ChatMessage'
import { db } from '~/lib/db.server'
import { attachWebSearchesToMessages } from '~/lib/web-searches.server'

interface SharedMessage {
  id: string
  role: string
  content: string
  model: string | null
  createdAt: string | Date
  webSearches?: WebSearchActivity[]
  files: Array<{ id: string; filename: string; mimeType: string; size: number }>
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.chat?.title ? `${data.chat.title} - Chathouse` : 'Shared Chat - Chathouse' },
]

export async function loader({ params }: LoaderFunctionArgs) {
  const sharedLink = await db.sharedLink.findUnique({
    where: { id: params.shareId },
    include: {
      chat: {
        include: {
          messages: {
            where: { status: 'complete' },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              role: true,
              content: true,
              model: true,
              createdAt: true,
              files: {
                select: {
                  id: true,
                  filename: true,
                  mimeType: true,
                  size: true,
                },
              },
            },
          },
          user: {
            select: { name: true },
          },
        },
      },
    },
  })

  if (!sharedLink) {
    throw new Response('Chat not found', { status: 404 })
  }

  db.sharedLink
    .update({
      where: { id: sharedLink.id },
      data: { viewCount: { increment: 1 } },
    })
    .catch(() => {})

  const { chat } = sharedLink

  let messages: SharedMessage[] = await attachWebSearchesToMessages(chat.messages)
  if (sharedLink.frozenAt) {
    messages = messages.filter((m: SharedMessage) => new Date(m.createdAt) <= sharedLink.frozenAt!)
  }

  if (!sharedLink.includeAttachments) {
    messages = messages.map((m: SharedMessage) => ({
      ...m,
      files: m.files.map((f: { id: string; filename: string; mimeType: string; size: number }) => ({
        ...f,
        id: '',
      })),
    }))
  }

  return {
    chat: {
      title: chat.title,
      createdAt: chat.createdAt,
      ownerName: chat.user.name,
    },
    messages,
    includeAttachments: sharedLink.includeAttachments,
  }
}

export default function SharedChatPage() {
  const { chat, messages, includeAttachments } = useLoaderData<typeof loader>()

  return (
    <div className="bg-surface-50 min-h-full">
      <header className="border-surface-200 border-b bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary-100 flex h-10 w-10 items-center justify-center rounded-xl">
              <ChatCircleIcon className="text-primary-600 h-5 w-5" weight="fill" />
            </div>
            <div>
              <h1 className="text-surface-900 text-lg font-semibold">{chat.title}</h1>
              <p className="text-surface-500 text-sm">Shared by {chat.ownerName || 'Anonymous'}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl">
        <div className="divide-surface-200 divide-y">
          {messages.map((message: SharedMessage) => (
            <ChatMessage
              key={message.id}
              id={message.id}
              role={message.role as 'user' | 'assistant'}
              content={message.content}
              model={message.model}
              files={includeAttachments ? message.files : undefined}
              webSearches={message.webSearches}
            />
          ))}
        </div>
      </main>

      <footer className="border-surface-200 border-t bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6 text-center">
          <p className="text-surface-500 text-sm">
            This conversation was shared via{' '}
            <Link to="/" className="text-primary-600 hover:text-primary-700 font-medium">
              Chathouse
            </Link>
          </p>
        </div>
      </footer>
    </div>
  )
}
