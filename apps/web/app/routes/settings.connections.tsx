import { CheckIcon, ArrowSquareOutIcon, KeyIcon, TrashIcon } from '@phosphor-icons/react'
import { useState, useEffect } from 'react'
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router'

import type { Provider } from '~/lib/models'

import { db } from '~/lib/db.server'
import { encrypt } from '~/lib/encryption.server'
import { validateOpenAICompatibleModelEndpoint } from '~/lib/ollama.server'
import { OLLAMA_DEFAULT_BASE_URL, OLLAMA_PRESETS, isProvider } from '~/lib/providers'
import { addModelRefreshJob } from '~/lib/queue.server'
import { requireAuth } from '~/lib/session.server'
import { cn } from '~/lib/utils'
import { Alert, Text, ProviderLogo, PROVIDER_NAMES, Panel, Input, Button, TabHeader } from '~/ui'

export function meta() {
  return [{ title: 'Connections - Chathouse' }]
}

interface ProviderConfig {
  id: Provider
  docsUrl: string
  docsLabel: string
  placeholder: string
  kind: 'api-key' | 'ollama'
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'anthropic',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    docsLabel: 'Get API key',
    placeholder: 'sk-ant-...',
    kind: 'api-key',
  },
  {
    id: 'openai',
    docsUrl: 'https://platform.openai.com/api-keys',
    docsLabel: 'Get API key',
    placeholder: 'sk-...',
    kind: 'api-key',
  },
  {
    id: 'google',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    docsLabel: 'Get API key',
    placeholder: 'AIza...',
    kind: 'api-key',
  },
  {
    id: 'ollama',
    docsUrl: 'https://docs.ollama.com/api/openai-compatibility',
    docsLabel: 'Open docs',
    placeholder: 'OpenWebUI token or leave blank',
    kind: 'ollama',
  },
]

function formatModelName(modelId: string): string {
  return modelId
    .replace(/[/_:-]+/g, ' ')
    .replace(/\b(llama|gemma|qwen|mistral|mixtral|deepseek|phi)(\d)/gi, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bGpt\b/g, 'GPT')
    .replace(/\bOss\b/g, 'OSS')
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bR(\d)\b/g, 'R$1')
    .replace(/\b(\d+)b\b/gi, '$1B')
    .trim()
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request)

  const apiKeys = await db.apiKey.findMany({
    where: { userId: user.id },
    select: {
      provider: true,
      updatedAt: true,
      baseUrl: true,
    },
  })

  const connectedProviders = apiKeys.reduce(
    (
      acc: Record<string, { connected: boolean; updatedAt: Date; baseUrl: string | null }>,
      key: { provider: string; updatedAt: Date; baseUrl: string | null },
    ) => {
      acc[key.provider] = { connected: true, updatedAt: key.updatedAt, baseUrl: key.baseUrl }
      return acc
    },
    {} as Record<string, { connected: boolean; updatedAt: Date; baseUrl: string | null }>,
  )

  return { connectedProviders }
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request)
  const formData = await request.formData()
  const intent = formData.get('intent') as string
  const provider = formData.get('provider')

  if (!isProvider(provider) || !PROVIDERS.some((item) => item.id === provider)) {
    return { error: 'Invalid provider' }
  }

  if (intent === 'save-key') {
    const apiKey = formData.get('apiKey') as string

    if (provider === 'ollama') {
      const baseUrlInput = (formData.get('baseUrl') as string) || OLLAMA_DEFAULT_BASE_URL
      let validated: { baseUrl: string; modelIds: string[] }

      try {
        validated = await validateOpenAICompatibleModelEndpoint(baseUrlInput, apiKey)
      } catch (reason) {
        return {
          error: reason instanceof Error ? reason.message : 'Could not reach the model endpoint',
          provider,
        }
      }

      await db.apiKey.upsert({
        where: {
          userId_provider: { userId: user.id, provider },
        },
        create: {
          userId: user.id,
          provider,
          encryptedKey: apiKey?.trim() ? encrypt(apiKey.trim()) : null,
          baseUrl: validated.baseUrl,
        },
        update: {
          encryptedKey: apiKey?.trim() ? encrypt(apiKey.trim()) : null,
          baseUrl: validated.baseUrl,
        },
      })

      await db.cachedModel.deleteMany({
        where: { userId: user.id, provider },
      })

      if (validated.modelIds.length > 0) {
        await db.cachedModel.createMany({
          data: validated.modelIds.map((modelId) => ({
            userId: user.id,
            modelId,
            provider,
            name: formatModelName(modelId),
          })),
          skipDuplicates: true,
        })
      }

      await addModelRefreshJob({ userId: user.id, provider })

      const count = validated.modelIds.length
      return {
        success: true,
        message:
          count === 0
            ? 'Connected. No models returned yet.'
            : `Connected successfully. Found ${count} model${count === 1 ? '' : 's'}.`,
        provider,
      }
    }

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
        baseUrl: null,
      },
    })

    await addModelRefreshJob({ userId: user.id, provider })

    return { success: true, message: `Connected successfully`, provider }
  }

  if (intent === 'remove-key') {
    await db.apiKey.deleteMany({
      where: { userId: user.id, provider },
    })

    await db.cachedModel.deleteMany({
      where: { userId: user.id, provider },
    })

    return { success: true, message: `Disconnected`, provider }
  }

  return { error: 'Invalid action' }
}

function ProviderCard({
  provider,
  connection,
}: {
  provider: ProviderConfig
  connection?: { connected: boolean; updatedAt: Date; baseUrl: string | null }
}) {
  const [inputValue, setInputValue] = useState('')
  const [baseUrlValue, setBaseUrlValue] = useState(OLLAMA_DEFAULT_BASE_URL)
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  const isThisProvider = actionData?.provider === provider.id
  const isThisSubmitting = isSubmitting && navigation.formData?.get('provider') === provider.id
  const isConnected = !!connection?.connected
  const isOllama = provider.kind === 'ollama'

  useEffect(() => {
    if (isThisProvider && actionData?.success && navigation.state === 'idle') {
      setInputValue('')
    }
  }, [isThisProvider, actionData?.success, navigation.state])

  const label = isOllama ? 'Ollama connection' : `${PROVIDER_NAMES[provider.id]} API Key`
  const canSubmit = isOllama ? !!baseUrlValue.trim() : !!inputValue.trim()

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
              {isOllama && connection?.baseUrl && (
                <Text size="xs" colour="muted" className="mt-1 max-w-md truncate">
                  {connection.baseUrl}
                </Text>
              )}
            </div>
            <Form method="post" className="shrink-0">
              <input type="hidden" name="intent" value="remove-key" />
              <input type="hidden" name="provider" value={provider.id} />
              <button
                type="submit"
                title={isOllama ? 'Remove connection' : 'Remove API key'}
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

            {isOllama ? (
              <>
                <Input
                  name="baseUrl"
                  label="Base URL"
                  value={baseUrlValue}
                  onChange={(e) => setBaseUrlValue(e.target.value)}
                  required
                  placeholder={OLLAMA_DEFAULT_BASE_URL}
                  autoComplete="off"
                  hint="Reached from the Chathouse server or worker, not from your browser."
                />
                <div className="flex flex-wrap gap-2">
                  {OLLAMA_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setBaseUrlValue(preset.value)}
                      className={cn(
                        'border-surface-200 text-surface-600 hover:bg-surface-50 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                        baseUrlValue === preset.value &&
                          'border-surface-400 bg-surface-50 text-surface-900',
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <Input
                  name="apiKey"
                  label="API key (optional)"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={provider.placeholder}
                  autoComplete="off"
                  revealable
                />
              </>
            ) : (
              <Input
                name="apiKey"
                label={label}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                required
                placeholder={provider.placeholder}
                autoComplete="off"
                revealable
              />
            )}

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
                {provider.docsLabel}
                <ArrowSquareOutIcon className="h-3 w-3" />
              </a>

              <Button type="submit" disabled={!canSubmit} isLoading={isThisSubmitting}>
                {isOllama ? 'Connect' : 'Save'}
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
        description="Add API keys and local endpoints for chat models"
        iconColorClass="text-emerald-500"
      />

      <div className="space-y-4">
        {PROVIDERS.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            connection={connectedProviders[provider.id]}
          />
        ))}
      </div>
    </div>
  )
}
