import { useState } from 'react'
import {
  redirect,
  useLoaderData,
  useNavigation,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from 'react-router'

import { ChatInput } from '~/components/ChatInput'
import { db } from '~/lib/db.server'
import { getModelsForSelectorWithMeta } from '~/lib/models.server'
import { addChatJob, addTitleJob } from '~/lib/queue.server'
import { requireAuth } from '~/lib/session.server'

export function meta() {
  return [
    { title: 'Chat - Chathouse' },
    { name: 'description', content: 'Start a new conversation' },
  ]
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request)
  const { models, hasConnections, totalModelsCount, connectedProviders } =
    await getModelsForSelectorWithMeta(user.id)

  const settings = await db.userSettings.findUnique({
    where: { userId: user.id },
    select: {
      systemPrompt: true,
      titleStrategy: true,
    },
  })

  return { user, models, hasConnections, totalModelsCount, connectedProviders, settings }
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request)
  const formData = await request.formData()
  const content = formData.get('content') as string
  const model = formData.get('model') as string
  const fileIdsRaw = formData.get('fileIds') as string
  const isTemporary = formData.get('isTemporary') === '1'

  if (!content?.trim()) {
    return { error: 'Message cannot be empty' }
  }

  if (!model) {
    return { error: 'Please select a model' }
  }

  const fileIds = fileIdsRaw ? fileIdsRaw.split(',').filter(Boolean) : []

  const settings = await db.userSettings.findUnique({
    where: { userId: user.id },
    select: {
      systemPrompt: true,
      titleStrategy: true,
    },
  })

  const chat = await db.chat.create({
    data: {
      userId: user.id,
      title: isTemporary ? 'Temporary Chat' : 'New Chat',
      isTemporary,
    },
  })

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
      verifiedFileIds = linked.map((f) => f.id)
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

  await addChatJob({
    messageId: assistantMessage.id,
    chatId: chat.id,
    userId: user.id,
    content: content.trim(),
    model,
    systemPrompt: settings?.systemPrompt || undefined,
    fileIds: verifiedFileIds,
  })

  if (!isTemporary) {
    await addTitleJob({
      chatId: chat.id,
      userId: user.id,
      firstMessage: content.trim(),
      strategy: (settings?.titleStrategy as 'ai' | 'first_chars') || 'ai',
    })
  }

  return redirect(`/chat/${chat.id}`)
}

function getGreeting(name?: string | null): string {
  const hour = new Date().getHours()
  let timeOfDay = 'Morning'
  if (hour < 5 || hour >= 17) timeOfDay = 'Evening'
  else if (hour >= 12) timeOfDay = 'Afternoon'

  if (name) {
    return `${timeOfDay}, ${name}`
  }
  return `Good ${timeOfDay}`
}

export default function NewChatPage() {
  const { user, models, connectedProviders } = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  const [selectedModel, setSelectedModel] = useState(models[0]?.id || '')
  const [isTemporary, setIsTemporary] = useState(false)

  const greeting = getGreeting(user.name)

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="w-full max-w-3xl text-center">
          <h1 className="font-display mb-12 text-4xl font-light tracking-tight text-stone-800">
            {greeting}
          </h1>

          <ChatInput
            models={models}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            isSubmitting={isSubmitting}
            placeholder="How can I help you today?"
            connectedProviders={connectedProviders}
            isTemporary={isTemporary}
            onTemporaryToggle={() => setIsTemporary((v) => !v)}
          />
        </div>
      </div>
    </div>
  )
}
