import { GearIcon } from '@phosphor-icons/react'
import { useState, useRef, useEffect } from 'react'
import {
  Form,
  useFetcher,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router'
import { toast } from 'sonner'

import { isRegistrationEnabled, setRegistrationEnabled } from '~/lib/auth.server'
import { db } from '~/lib/db.server'
import { requireAuth } from '~/lib/session.server'
import { Text, Switch, Panel, Tooltip, Input, TabHeader } from '~/ui'

export function meta() {
  return [{ title: 'Preferences - Chathouse' }]
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request)

  const settings = await db.userSettings.findUnique({
    where: { userId: user.id },
  })

  const registrationEnabled = await isRegistrationEnabled()

  const apiKeys = await db.apiKey.findMany({
    where: { userId: user.id },
    select: { provider: true },
  })
  const hasAnyApiKey = apiKeys.length > 0

  return { settings, registrationEnabled, hasAnyApiKey }
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request)
  const formData = await request.formData()
  const intent = formData.get('intent') as string

  if (intent === 'update-preferences') {
    const systemPrompt = formData.get('systemPrompt') as string
    const chatHistoryEnabled = formData.get('chatHistoryEnabled') === 'true'
    const chatRetentionDays = parseInt(formData.get('chatRetentionDays') as string) || 90
    const titleStrategy = formData.get('titleStrategy') as string

    await db.userSettings.update({
      where: { userId: user.id },
      data: {
        systemPrompt: systemPrompt || null,
        chatHistoryEnabled,
        chatRetentionDays: Math.max(1, Math.min(365, chatRetentionDays)),
        titleStrategy,
      },
    })

    return { success: true, message: 'Preferences saved' }
  }

  if (intent === 'toggle-registration') {
    const enabled = formData.get('enabled') === 'true'
    await setRegistrationEnabled(enabled)
    return {
      success: true,
      message: `Registration ${enabled ? 'enabled' : 'disabled'}`,
    }
  }

  return { error: 'Invalid action' }
}

export default function PreferencesSettingsPage() {
  const { settings, registrationEnabled, hasAnyApiKey } = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  const fetcher = useFetcher()

  const [titleStrategy, setTitleStrategy] = useState(settings?.titleStrategy ?? 'ai')
  const [chatHistoryEnabled, setChatHistoryEnabled] = useState(settings?.chatHistoryEnabled ?? true)

  const formRef = useRef<HTMLFormElement>(null)

  const submitPreferences = () => {
    if (!formRef.current) return
    const formData = new FormData(formRef.current)
    formData.set('intent', 'update-preferences')
    formData.set('chatHistoryEnabled', chatHistoryEnabled ? 'true' : 'false')
    formData.set('titleStrategy', titleStrategy)
    fetcher.submit(formData, { method: 'post' })
  }

  useEffect(() => {
    if (fetcher.data?.success) {
      toast.success(fetcher.data.message)
    } else if (fetcher.data?.error) {
      toast.error(fetcher.data.error)
    }
  }, [fetcher.data])

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <TabHeader
        icon={GearIcon}
        label="Preferences"
        description="Customize your Chathouse experience"
        iconColorClass="text-purple-500"
      />

      <form ref={formRef} className="mt-8 space-y-8">
        <input type="hidden" name="intent" value="update-preferences" />
        <input
          type="hidden"
          name="chatHistoryEnabled"
          value={chatHistoryEnabled ? 'true' : 'false'}
        />
        <input type="hidden" name="titleStrategy" value={titleStrategy} />

        <Panel>
          <Text as="h2" size="lg" weight="semibold">
            System Prompt
          </Text>
          <Text size="sm" colour="muted" className="mt-1">
            Set a default system prompt for all your conversations
          </Text>

          <div className="mt-4">
            <label
              htmlFor="systemPrompt"
              className="text-surface-700 mb-1.5 block text-sm font-medium"
            >
              System Prompt
            </label>
            <textarea
              id="systemPrompt"
              name="systemPrompt"
              rows={4}
              defaultValue={settings?.systemPrompt || ''}
              onBlur={submitPreferences}
              className="border-surface-300 text-surface-900 placeholder:text-surface-400 focus:border-primary-500 focus:ring-primary-500/20 block w-full rounded-lg border bg-white px-4 py-2.5 focus:ring-2 focus:outline-none"
              placeholder="You are a helpful assistant..."
            />
            <p className="text-surface-500 mt-1.5 text-sm">
              This prompt will be prepended to all your conversations
            </p>
          </div>
        </Panel>

        <Panel>
          <Text as="h2" size="lg" weight="semibold">
            Chat History
          </Text>
          <Text size="sm" colour="muted" className="mt-1">
            Configure how your chat history is stored
          </Text>

          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="chatHistoryEnabled" className="text-surface-900 font-medium">
                  Save chat history
                </label>
                <p className="text-surface-500 text-sm">
                  When disabled, chats won't be saved after the session
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setChatHistoryEnabled(!chatHistoryEnabled)
                  setTimeout(() => {
                    if (formRef.current) {
                      const formData = new FormData(formRef.current)
                      formData.set('intent', 'update-preferences')
                      formData.set('chatHistoryEnabled', (!chatHistoryEnabled).toString())
                      formData.set('titleStrategy', titleStrategy)
                      fetcher.submit(formData, { method: 'post' })
                    }
                  }, 0)
                }}
              >
                <Switch checked={chatHistoryEnabled} />
              </button>
            </div>

            <Input
              id="chatRetentionDays"
              name="chatRetentionDays"
              type="number"
              min={1}
              max={365}
              label="Retention period (days)"
              defaultValue={settings?.chatRetentionDays ?? 90}
              onBlur={submitPreferences}
              className="w-32"
              hint="Chats older than this will be automatically deleted"
            />
          </div>
        </Panel>

        <Panel>
          <Text as="h2" size="lg" weight="semibold">
            Chat Titles
          </Text>
          <Text size="sm" colour="muted" className="mt-1">
            Configure how chat titles are generated
          </Text>

          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="titleStrategy"
                className="text-surface-700 mb-1.5 block text-sm font-medium"
              >
                Title generation strategy
              </label>
              {!hasAnyApiKey ? (
                <Tooltip content="Connect an API key in Connections to use AI-generated titles">
                  <select
                    id="titleStrategy"
                    value={titleStrategy}
                    onChange={(e) => {
                      setTitleStrategy(e.target.value)
                      setTimeout(() => {
                        if (formRef.current) {
                          const formData = new FormData(formRef.current)
                          formData.set('intent', 'update-preferences')
                          formData.set('chatHistoryEnabled', chatHistoryEnabled.toString())
                          formData.set('titleStrategy', e.target.value)
                          fetcher.submit(formData, { method: 'post' })
                        }
                      }, 0)
                    }}
                    className="border-surface-300 text-surface-900 focus:border-primary-500 focus:ring-primary-500/20 block w-full rounded-lg border bg-white px-4 py-2.5 focus:ring-2 focus:outline-none"
                  >
                    <option value="ai" disabled className="text-surface-400">
                      AI-generated (uses API credits)
                    </option>
                    <option value="first_chars">First characters of message</option>
                  </select>
                </Tooltip>
              ) : (
                <select
                  id="titleStrategy"
                  value={titleStrategy}
                  onChange={(e) => {
                    setTitleStrategy(e.target.value)
                    setTimeout(() => {
                      if (formRef.current) {
                        const formData = new FormData(formRef.current)
                        formData.set('intent', 'update-preferences')
                        formData.set('chatHistoryEnabled', chatHistoryEnabled.toString())
                        formData.set('titleStrategy', e.target.value)
                        fetcher.submit(formData, { method: 'post' })
                      }
                    }, 0)
                  }}
                  className="border-surface-300 text-surface-900 focus:border-primary-500 focus:ring-primary-500/20 block w-full rounded-lg border bg-white px-4 py-2.5 focus:ring-2 focus:outline-none"
                >
                  <option value="ai">AI-generated (uses API credits)</option>
                  <option value="first_chars">First characters of message</option>
                </select>
              )}
            </div>

            {titleStrategy === 'ai' && (
              <p className="text-surface-500 text-sm">
                A lightweight model from your connected providers will be used automatically
              </p>
            )}
          </div>
        </Panel>
      </form>

      <Panel className="mt-8">
        <Text as="h2" size="lg" weight="semibold">
          Admin Settings
        </Text>
        <Text size="sm" colour="muted" className="mt-1">
          Configure application-wide settings
        </Text>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex flex-col">
            <Text weight="medium">User Registration</Text>
            <Text size="sm" colour="muted">
              Allow new users to create accounts
            </Text>
          </div>
          <Form method="post">
            <input type="hidden" name="intent" value="toggle-registration" />
            <input type="hidden" name="enabled" value={(!registrationEnabled).toString()} />
            <button type="submit" disabled={isSubmitting}>
              <Switch checked={registrationEnabled} disabled={isSubmitting} />
            </button>
          </Form>
        </div>
      </Panel>
    </div>
  )
}
