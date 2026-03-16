import {
  CheckIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowSquareOutIcon,
  KeyIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { useState, useEffect } from 'react'
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router'

import { db } from '~/lib/db.server'
import { encrypt } from '~/lib/encryption.server'
import { addModelRefreshJob } from '~/lib/queue.server'
import { requireAuth } from '~/lib/session.server'
import { Alert, Text, ProviderLogo, PROVIDER_NAMES, Panel, Input, Button, TabHeader } from '~/ui'

export function meta() {
  return [{ title: 'Connections - Chathouse' }]
}

interface ProviderConfig {
  id: 'openai' | 'anthropic' | 'google'
  docsUrl: string
  placeholder: string
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'anthropic',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    placeholder: 'sk-ant-...',
  },
  {
    id: 'openai',
    docsUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-...',
  },
  {
    id: 'google',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    placeholder: 'AIza...',
  },
]

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request)

  const apiKeys = await db.apiKey.findMany({
    where: { userId: user.id },
    select: {
      provider: true,
      updatedAt: true,
    },
  })

  const connectedProviders = apiKeys.reduce(
    (acc, key) => {
      acc[key.provider] = { connected: true, updatedAt: key.updatedAt }
      return acc
    },
    {} as Record<string, { connected: boolean; updatedAt: Date }>,
  )

  return { connectedProviders }
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request)
  const formData = await request.formData()
  const intent = formData.get('intent') as string
  const provider = formData.get('provider') as string

  if (!provider || !PROVIDERS.some((p) => p.id === provider)) {
    return { error: 'Invalid provider' }
  }

  if (intent === 'save-key') {
    const apiKey = formData.get('apiKey') as string

    if (!apiKey?.trim()) {
      return { error: 'API key is required', provider }
    }

    const encryptedKey = encrypt(apiKey.trim())

    await db.apiKey.upsert({
      where: {
        userId_provider: { userId: user.id, provider },
      },
      create: {
        userId: user.id,
        provider,
        encryptedKey,
      },
      update: {
        encryptedKey,
      },
    })

    await addModelRefreshJob({
      userId: user.id,
      provider: provider as 'openai' | 'anthropic' | 'google',
    })

    return { success: true, message: `Connected successfully`, provider }
  }

  if (intent === 'remove-key') {
    await db.apiKey.delete({
      where: {
        userId_provider: { userId: user.id, provider },
      },
    })

    return { success: true, message: `Disconnected`, provider }
  }

  return { error: 'Invalid action' }
}

function ProviderCard({
  provider,
  isConnected,
}: {
  provider: ProviderConfig
  isConnected: boolean
}) {
  const [showKey, setShowKey] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  const isThisProvider = actionData?.provider === provider.id

  useEffect(() => {
    if (isThisProvider && actionData?.success && navigation.state === 'idle') {
      setInputValue('')
    }
  }, [isThisProvider, actionData?.success, navigation.state])

  const label = `${PROVIDER_NAMES[provider.id]} API Key`

  return (
    <Panel className="relative overflow-hidden transition-all">
      <div className="pointer-events-none absolute -bottom-4 -left-4 opacity-10">
        <ProviderLogo provider={provider.id} size="lg" className="h-20 w-20" />
      </div>

      <div className="relative">
        {isConnected ? (
          <div className="flex items-center justify-between">
            <div>
              <Text size="sm" weight="medium" className="text-surface-700">
                {label}
              </Text>
              <div className="mt-1.5 flex items-center gap-2 text-green-600">
                <CheckIcon className="h-4 w-4" weight="bold" />
                <Text size="sm" weight="medium" className="text-green-600">
                  Connected
                </Text>
              </div>
            </div>
            <Form method="post" className="shrink-0">
              <input type="hidden" name="intent" value="remove-key" />
              <input type="hidden" name="provider" value={provider.id} />
              <button
                type="submit"
                title="Remove API key"
                className="text-surface-400 rounded-lg p-2 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </Form>
          </div>
        ) : (
          <Form method="post" className="space-y-3">
            <input type="hidden" name="intent" value="save-key" />
            <input type="hidden" name="provider" value={provider.id} />

            <Input
              name="apiKey"
              label={label}
              type={showKey ? 'text' : 'password'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              required
              placeholder={provider.placeholder}
              autoComplete="off"
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="text-surface-400 hover:text-surface-600 rounded-lg p-1 transition-colors"
                >
                  {showKey ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              }
            />

            {isThisProvider && actionData?.error && (
              <Alert variant="error">{actionData.error}</Alert>
            )}

            <div className="flex items-center justify-between">
              <a
                href={provider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-surface-500 hover:text-primary-600 inline-flex items-center gap-1 text-sm hover:underline"
              >
                Get API key
                <ArrowSquareOutIcon className="h-3 w-3" />
              </a>

              <Button type="submit" disabled={!inputValue.trim()} isLoading={isSubmitting}>
                Save
              </Button>
            </div>
          </Form>
        )}
      </div>

      {isThisProvider && actionData?.success && (
        <Alert variant="success" className="mt-3">
          {actionData.message}
        </Alert>
      )}
    </Panel>
  )
}

export default function ConnectionsSettingsPage() {
  const { connectedProviders } = useLoaderData<typeof loader>()

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <TabHeader
        icon={KeyIcon}
        label="Connections"
        description="Add your API keys to chat with models from different providers"
        iconColorClass="text-emerald-500"
      />

      <div className="space-y-4">
        {PROVIDERS.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            isConnected={!!connectedProviders[provider.id]?.connected}
          />
        ))}
      </div>
    </div>
  )
}
