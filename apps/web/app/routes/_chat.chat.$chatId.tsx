import { isReasoningLevel } from '@chathouse/database'
import { GitBranchIcon, ShareNetworkIcon } from '@phosphor-icons/react'
import { useState, useEffect, useRef } from 'react'
import {
  Link,
  redirect,
  useLoaderData,
  useNavigate,
  useNavigation,
  useRevalidator,
  useFetcher,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  type MetaFunction,
} from 'react-router'

import type { ReasoningLevel } from '~/lib/models'
import type { WebSearchActivity } from '~/lib/web-searches'

import { ChatInput } from '~/components/ChatInput'
import { ChatMessage } from '~/components/ChatMessage'
import { ShareDialog } from '~/components/ShareDialog'
import { performChatAction } from '~/lib/chat-actions'
import { isMissingColumnError } from '~/lib/db-errors.server'
import { db } from '~/lib/db.server'
import { getModelsForSelectorWithMeta } from '~/lib/models.server'
import { addChatJob } from '~/lib/queue.server'
import { requireAuth } from '~/lib/session.server'
import { attachWebSearchesToMessages } from '~/lib/web-searches.server'

interface MessageRow {
  id: string
  role: string
  content: string
  status: string
  error: string | null
  model: string | null
  webSearches?: WebSearchActivity[]
  files: Array<{ id: string; filename: string; mimeType: string; size: number }>
}

const PLACEHOLDER_CHAT_TITLE = 'New Chat'
const TITLE_POLL_INTERVAL_MS = 2000
const TITLE_POLL_WINDOW_MS = 30000

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  {
    title: data?.chat?.title ? `${data.chat.title} - Chathouse` : 'Chat - Chathouse',
  },
]

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireAuth(request)

  const chat = await db.chat.findUnique({
    where: { id: params.chatId, userId: user.id },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
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
    },
  })

  if (!chat) {
    throw redirect('/chat')
  }

  const messages = await attachWebSearchesToMessages(chat.messages)

  const { models, hasConnections, totalModelsCount, connectedProviders } =
    await getModelsForSelectorWithMeta(user.id)

  const settings = await db.userSettings.findUnique({
    where: { userId: user.id },
    select: {
      systemPrompt: true,
    },
  })

  const hasPendingMessage = chat.messages.some(
    (m: MessageRow) => m.status === 'pending' || m.status === 'processing',
  )

  let branchedFrom: { id: string; title: string } | null = null
  if (chat.branchedFromId) {
    const parent = await db.chat.findUnique({
      where: { id: chat.branchedFromId, userId: user.id },
      select: { id: true, title: true },
    })
    branchedFrom = parent
  }

  return {
    user,
    chat: { ...chat, messages },
    models,
    hasConnections,
    totalModelsCount,
    connectedProviders,
    settings,
    hasPendingMessage,
    branchedFrom,
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireAuth(request)
  const formData = await request.formData()
  const actionType = formData.get('action') as string
  const content = formData.get('content') as string
  const model = formData.get('model') as string
  const messageId = formData.get('messageId') as string
  const fileIdsRaw = formData.get('fileIds') as string
  const fileIds = fileIdsRaw ? fileIdsRaw.split(',').filter(Boolean) : []
  const reasoningEffortRaw = formData.get('reasoningEffort')
  const reasoningEffort = isReasoningLevel(reasoningEffortRaw) ? reasoningEffortRaw : undefined

  const chat = await db.chat.findUnique({
    where: { id: params.chatId, userId: user.id },
  })

  if (!chat) {
    return redirect('/chat')
  }

  const settings = await db.userSettings.findUnique({
    where: { userId: user.id },
    select: {
      systemPrompt: true,
    },
  })

  if (actionType === 'retry' && messageId) {
    const messageToRetry = await db.message.findUnique({
      where: { id: messageId, chatId: chat.id },
    })

    if (!messageToRetry || messageToRetry.role !== 'assistant') {
      return { error: 'Invalid message' }
    }

    const previousMessages = await db.message.findMany({
      where: { chatId: chat.id },
      orderBy: { createdAt: 'asc' },
    })

    const msgIndex = previousMessages.findIndex((m: { id: string }) => m.id === messageId)
    if (msgIndex <= 0) {
      return { error: 'No user message found' }
    }

    const lastUserMessage = previousMessages[msgIndex - 1]
    if (lastUserMessage.role !== 'user') {
      return { error: 'Previous message is not from user' }
    }

    const userFiles = await db.file.findMany({
      where: { messageId: lastUserMessage.id },
      select: { id: true },
    })

    try {
      await db.$executeRaw`UPDATE messages SET webSearches = NULL WHERE id = ${messageId}`
    } catch (reason) {
      if (!isMissingColumnError(reason, 'webSearches')) throw reason
    }

    await db.message.update({
      where: { id: messageId },
      data: {
        content: '',
        status: 'pending',
        error: null,
        model: model || messageToRetry.model,
      },
    })

    await addChatJob({
      messageId: messageId,
      chatId: chat.id,
      userId: user.id,
      content: lastUserMessage.content,
      model: model || messageToRetry.model || 'gpt-4o-mini',
      systemPrompt: settings?.systemPrompt || undefined,
      fileIds: userFiles.length > 0 ? userFiles.map((f: { id: string }) => f.id) : undefined,
      reasoningEffort,
    })

    return { success: true }
  }

  if (actionType === 'edit' && messageId) {
    if (!content?.trim()) {
      return { error: 'Message cannot be empty' }
    }

    if (!model) {
      return { error: 'Please select a model' }
    }

    const messageToEdit = await db.message.findUnique({
      where: { id: messageId, chatId: chat.id },
    })

    if (!messageToEdit || messageToEdit.role !== 'user') {
      return { error: 'Invalid message' }
    }

    await db.message.deleteMany({
      where: {
        chatId: chat.id,
        createdAt: { gt: messageToEdit.createdAt },
      },
    })

    await db.message.update({
      where: { id: messageId },
      data: { content: content.trim() },
    })

    if (fileIds.length > 0) {
      await db.file.updateMany({
        where: { id: { in: fileIds }, userId: user.id },
        data: { messageId },
      })
    }

    const editFiles = await db.file.findMany({
      where: { messageId },
      select: { id: true },
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
      fileIds: editFiles.length > 0 ? editFiles.map((f: { id: string }) => f.id) : undefined,
      reasoningEffort,
    })

    return { success: true }
  }

  if (!content?.trim()) {
    return { error: 'Message cannot be empty' }
  }

  if (!model) {
    return { error: 'Please select a model' }
  }

  const userMessage = await db.message.create({
    data: {
      chatId: chat.id,
      role: 'user',
      content: content.trim(),
      status: 'complete',
    },
  })

  // Link uploaded files to the message and collect verified IDs
  let verifiedFileIds: string[] | undefined
  if (fileIds.length > 0) {
    await db.file.updateMany({
      where: { id: { in: fileIds }, userId: user.id },
      data: { messageId: userMessage.id },
    })
    const linked = await db.file.findMany({
      where: { messageId: userMessage.id },
      select: { id: true },
    })
    if (linked.length > 0) {
      verifiedFileIds = linked.map((f: { id: string }) => f.id)
    }
  }

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
    fileIds: verifiedFileIds,
    reasoningEffort,
  })

  return { success: true }
}

export default function ChatPage() {
  const { chat, models, connectedProviders, hasPendingMessage, branchedFrom } =
    useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const navigation = useNavigation()
  const revalidator = useRevalidator()
  const fetcher = useFetcher()
  const isSubmitting = navigation.state === 'submitting'
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastUserMsgRef = useRef<HTMLDivElement>(null)
  const prevChatIdRef = useRef<string | null>(null)
  const prevMessageCountRef = useRef(0)

  // Guard: temporary chats are only accessible within the same browser tab session
  const [tempChatAllowed, setTempChatAllowed] = useState(!chat.isTemporary)
  useEffect(() => {
    if (!chat.isTemporary) return

    const stored: string[] = JSON.parse(sessionStorage.getItem('temp_chats') || '[]')

    if (sessionStorage.getItem('temp_chat_creating')) {
      sessionStorage.removeItem('temp_chat_creating')
      if (!stored.includes(chat.id)) stored.push(chat.id)
      sessionStorage.setItem('temp_chats', JSON.stringify(stored))
      setTempChatAllowed(true)
      return
    }

    if (stored.includes(chat.id)) {
      setTempChatAllowed(true)
    } else {
      navigate('/chat', { replace: true })
    }
  }, [chat.id, chat.isTemporary, navigate])

  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')

  const [streamingContent, setStreamingContent] = useState<Record<string, string>>({})
  const [streamingWebSearches, setStreamingWebSearches] = useState<
    Record<string, WebSearchActivity[]>
  >({})
  const [streamErrors, setStreamErrors] = useState<Record<string, string>>({})
  const eventSourceRef = useRef<EventSource | null>(null)
  const streamingMessageIdRef = useRef<string | null>(null)

  // Get the last used model or default to first
  const lastAssistantMessage = [...chat.messages]
    .toReversed()
    .find((m) => m.role === 'assistant' && m.model)
  const [selectedModel, setSelectedModel] = useState(
    lastAssistantMessage?.model || models[0]?.id || '',
  )
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningLevel | undefined>()

  const pendingMessage = chat.messages.find(
    (m: MessageRow) => m.status === 'pending' || m.status === 'processing',
  )
  const shouldPollForTitle =
    !chat.isTemporary &&
    chat.title === PLACEHOLDER_CHAT_TITLE &&
    chat.messages.length > 0 &&
    Date.now() - new Date(chat.createdAt).getTime() < TITLE_POLL_WINDOW_MS

  const lastUserMessageIndex = chat.messages.findLastIndex((m: MessageRow) => m.role === 'user')

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    if (prevChatIdRef.current !== chat.id) {
      prevChatIdRef.current = chat.id
      prevMessageCountRef.current = chat.messages.length
      container.scrollTop = container.scrollHeight
      return
    }

    const prevCount = prevMessageCountRef.current
    const currentCount = chat.messages.length
    prevMessageCountRef.current = currentCount

    if (currentCount > prevCount && lastUserMsgRef.current) {
      lastUserMsgRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [chat.id, chat.messages.length])

  // SSE streaming for pending messages
  useEffect(() => {
    if (!pendingMessage) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
        streamingMessageIdRef.current = null
      }
      setStreamingContent({})
      setStreamingWebSearches({})
      return
    }

    const messageId = pendingMessage.id
    setStreamErrors((prev) => {
      if (!(messageId in prev)) return prev
      const next = { ...prev }
      delete next[messageId]
      return next
    })

    // Don't create a new connection if we already have one for this message
    if (streamingMessageIdRef.current === messageId && eventSourceRef.current) {
      return
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const eventSource = new EventSource(`/api/chat/stream/${messageId}`)
    eventSourceRef.current = eventSource
    streamingMessageIdRef.current = messageId

    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'content') {
          setStreamingContent((prev) => ({
            ...prev,
            [messageId]: data.content,
          }))
        } else if (data.type === 'webSearches' && Array.isArray(data.webSearches)) {
          setStreamingWebSearches((prev) => ({
            ...prev,
            [messageId]: data.webSearches,
          }))
        } else if (data.type === 'webSearch' && data.webSearch) {
          setStreamingWebSearches((prev) => {
            const current = prev[messageId] || []
            const index = current.findIndex((item) => item.id === data.webSearch.id)
            const next = index === -1 ? [...current, data.webSearch] : [...current]
            if (index !== -1) next[index] = data.webSearch
            return {
              ...prev,
              [messageId]: next,
            }
          })
        } else if (data.type === 'delta') {
          setStreamingContent((prev) => ({
            ...prev,
            [messageId]: (prev[messageId] || '') + data.content,
          }))
        } else if (data.type === 'done') {
          eventSource.close()
          eventSourceRef.current = null
          streamingMessageIdRef.current = null
          revalidator.revalidate()
        } else if (data.type === 'error') {
          setStreamErrors((prev) => ({
            ...prev,
            [messageId]: data.error || 'The model failed to generate a response.',
          }))
          eventSource.close()
          eventSourceRef.current = null
          streamingMessageIdRef.current = null
          revalidator.revalidate()
        }
      } catch {}
    })

    eventSource.addEventListener('error', () => {
      eventSource.close()
      eventSourceRef.current = null
      streamingMessageIdRef.current = null
      revalidator.revalidate()
    })

    return () => {
      eventSource.close()
      eventSourceRef.current = null
      streamingMessageIdRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage?.id, revalidator])

  useEffect(() => {
    if (!shouldPollForTitle) return

    const intervalId = window.setInterval(() => {
      revalidator.revalidate()
    }, TITLE_POLL_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [revalidator, shouldPollForTitle])

  const handleRetry = (messageId: string) => {
    setStreamErrors((prev) => {
      if (!(messageId in prev)) return prev
      const next = { ...prev }
      delete next[messageId]
      return next
    })

    const formData = new FormData()
    formData.append('action', 'retry')
    formData.append('messageId', messageId)
    formData.append('model', selectedModel)
    if (reasoningEffort) formData.append('reasoningEffort', reasoningEffort)
    fetcher.submit(formData, { method: 'post' })
  }

  const handleEdit = (messageId: string, content: string) => {
    setEditingMessageId(messageId)
    setEditingContent(content)
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditingContent('')
  }

  const handleBranch = async (messageId: string) => {
    try {
      const result = await performChatAction({
        chatId: chat.id,
        action: 'branch',
        messageId,
      })
      if (result?.chatId) {
        navigate(`/chat/${result.chatId}`)
      }
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "Couldn't branch chat. Please try again.")
    }
  }

  if (!tempChatAllowed) return null

  return (
    <div className="relative flex h-full min-w-0 flex-col bg-white">
      <header className="hidden shrink-0 flex-col border-b border-stone-200 bg-white md:flex">
        <div className="flex h-14 items-center justify-between px-4">
          <h1 className="truncate text-lg font-medium text-stone-800">{chat.title}</h1>
          {!chat.isTemporary && (
            <button
              onClick={() => setIsShareDialogOpen(true)}
              className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-stone-100"
            >
              <ShareNetworkIcon className="h-5 w-5" />
            </button>
          )}
        </div>
        {chat.branchedFromId && (
          <div className="flex items-center gap-1.5 border-t border-stone-100 bg-stone-50 px-4 py-1.5">
            <GitBranchIcon className="h-3.5 w-3.5 text-indigo-400" />
            {branchedFrom ? (
              <span className="text-xs text-stone-500">
                Branched from:{' '}
                <Link
                  to={`/chat/${branchedFrom.id}`}
                  className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                >
                  {branchedFrom.title}
                </Link>
              </span>
            ) : (
              <span className="text-xs text-stone-400">Branched from a deleted chat</span>
            )}
          </div>
        )}
      </header>

      <div
        ref={scrollContainerRef}
        className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto py-4 pb-32"
      >
        <div className="mx-auto w-full max-w-3xl min-w-0">
          {chat.messages.map((message: MessageRow, index: number) => {
            const isLastUserMessage = index === lastUserMessageIndex

            // If editing this message, show inline editor
            if (editingMessageId === message.id && message.role === 'user') {
              return (
                <div
                  key={message.id}
                  ref={isLastUserMessage ? lastUserMsgRef : undefined}
                  className="px-4 py-3"
                >
                  <div className="flex justify-end">
                    <div className="w-full max-w-full md:max-w-[75%]">
                      <fetcher.Form method="post">
                        <input type="hidden" name="action" value="edit" />
                        <input type="hidden" name="messageId" value={message.id} />
                        <input type="hidden" name="model" value={selectedModel} />
                        {reasoningEffort && (
                          <input type="hidden" name="reasoningEffort" value={reasoningEffort} />
                        )}
                        <div className="rounded-2xl border border-stone-300 bg-white p-3 shadow-sm">
                          <textarea
                            name="content"
                            defaultValue={editingContent}
                            rows={3}
                            autoFocus
                            className="w-full resize-none bg-transparent text-stone-800 focus:outline-none"
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') handleCancelEdit()
                            }}
                          />
                          <div className="mt-2 flex items-center justify-between">
                            <select
                              value={selectedModel}
                              onChange={(e) => setSelectedModel(e.target.value)}
                              className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-sm text-stone-600"
                            >
                              {models.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.versionLabel ? `${m.name} (${m.versionLabel})` : m.name}
                                </option>
                              ))}
                            </select>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="rounded-lg px-3 py-1.5 text-sm text-stone-500 transition-colors hover:bg-stone-100"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="bg-primary-600 hover:bg-primary-700 rounded-lg px-3 py-1.5 text-sm text-white transition-colors"
                              >
                                Save & Send
                              </button>
                            </div>
                          </div>
                        </div>
                      </fetcher.Form>
                    </div>
                  </div>
                </div>
              )
            }

            // Use streaming content if available for pending/processing messages
            const isMessageStreaming =
              (message.status === 'pending' || message.status === 'processing') &&
              !!streamingContent[message.id]
            const displayContent = isMessageStreaming
              ? streamingContent[message.id]
              : message.content
            const displayWebSearches =
              streamingWebSearches[message.id] ??
              (message.status === 'pending' || message.status === 'processing'
                ? []
                : (message.webSearches ?? []))
            const hasVisibleContent = displayContent.trim().length > 0
            const effectiveError =
              streamErrors[message.id] ||
              message.error ||
              (message.role === 'assistant' &&
              !hasVisibleContent &&
              message.status !== 'pending' &&
              message.status !== 'processing'
                ? 'The model returned an empty response. Please try again or switch models.'
                : null)
            const effectiveStatus = effectiveError ? 'error' : message.status

            const chatMessageEl = (
              <ChatMessage
                key={message.id}
                id={message.id}
                role={message.role as 'user' | 'assistant'}
                content={displayContent}
                status={effectiveStatus as 'pending' | 'processing' | 'complete' | 'error'}
                error={effectiveError}
                model={message.model}
                isLatest={index === chat.messages.length - 1}
                isStreaming={isMessageStreaming}
                onRetry={handleRetry}
                onEdit={handleEdit}
                onBranch={handleBranch}
                files={message.files}
                webSearches={displayWebSearches}
              />
            )

            if (isLastUserMessage) {
              return (
                <div key={message.id} ref={lastUserMsgRef}>
                  {chatMessageEl}
                </div>
              )
            }

            return chatMessageEl
          })}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 z-10 w-full bg-transparent p-2 !pt-0 pb-6 md:p-4">
        <ChatInput
          models={models}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          isSubmitting={isSubmitting || hasPendingMessage}
          placeholder={hasPendingMessage ? 'Waiting for response...' : 'Reply...'}
          connectedProviders={connectedProviders}
          isTemporary={chat.isTemporary}
          reasoningEffort={reasoningEffort}
          onReasoningEffortChange={setReasoningEffort}
        />
      </div>

      <ShareDialog
        isOpen={isShareDialogOpen}
        onClose={() => setIsShareDialogOpen(false)}
        chatId={chat.id}
        chatTitle={chat.title}
      />
    </div>
  )
}
