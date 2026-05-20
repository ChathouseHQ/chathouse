import {
  MagnifyingGlassIcon,
  StarIcon,
  ArrowsClockwiseIcon,
  CpuIcon,
  EyeIcon,
  BrainIcon,
} from '@phosphor-icons/react'
import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Link,
  useFetcher,
  useLoaderData,
  useRevalidator,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router'

import { db } from '~/lib/db.server'
import { type ModelFeature, type PriceTier, type Provider, type ReasoningLevel } from '~/lib/models'
import {
  getUserModelSettings,
  toggleModelEnabled,
  toggleModelFavorite,
  getCachedModels,
  setProviderModelsEnabled,
  type UserModelSetting,
} from '~/lib/models.server'
import { ALL_PROVIDERS } from '~/lib/providers'
import { addModelRefreshJob } from '~/lib/queue.server'
import { requireAuth } from '~/lib/session.server'
import { cn } from '~/lib/utils'
import {
  Alert,
  Text,
  Switch,
  Badge,
  ProviderLogo,
  PROVIDER_NAMES,
  Panel,
  Input,
  TabHeader,
} from '~/ui'

export function meta() {
  return [{ title: 'Models - Chathouse' }]
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request)

  const modelSettings = await getUserModelSettings(user.id)

  const apiKeys = await db.apiKey.findMany({
    where: { userId: user.id },
    select: { provider: true },
  })

  const connectedProviders = apiKeys.map((k: { provider: string }) => k.provider)

  const { models: cachedModels, lastRefresh } = await getCachedModels(user.id)

  return { modelSettings, connectedProviders, cachedModels, lastRefresh }
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request)
  const formData = await request.formData()
  const intent = formData.get('intent') as string
  const modelId = formData.get('modelId') as string

  if (intent === 'refresh-models') {
    await addModelRefreshJob({ userId: user.id })
    return { success: true, refreshing: true }
  }

  if (intent === 'toggle-all-provider') {
    const provider = formData.get('provider') as Provider
    const enabled = formData.get('enabled') === 'true'

    const { models } = await getCachedModels(user.id)
    const providerModels = models.filter((m) => m.provider === provider)

    await setProviderModelsEnabled(
      user.id,
      providerModels.map((m) => m.id),
      enabled,
    )

    return { success: true }
  }

  if (!modelId) {
    return { error: 'Model ID is required' }
  }

  if (intent === 'toggle-enabled') {
    const newEnabled = await toggleModelEnabled(user.id, modelId)
    return { success: true, modelId, enabled: newEnabled }
  }

  if (intent === 'toggle-favorite') {
    const newFavorite = await toggleModelFavorite(user.id, modelId)
    return { success: true, modelId, favorite: newFavorite }
  }

  return { error: 'Invalid action' }
}

function ProviderToggle({
  provider,
  models,
  modelSettings,
}: {
  provider: Provider
  models: Array<{ id: string }>
  modelSettings: Record<string, UserModelSetting>
}) {
  const fetcher = useFetcher()
  const isLoading = fetcher.state !== 'idle'

  const allEnabled = models.every((m) => modelSettings[m.id]?.enabled ?? true)

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="toggle-all-provider" />
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="enabled" value={allEnabled ? 'false' : 'true'} />
      <button type="submit" disabled={isLoading} className="flex items-center gap-2">
        <Text size="xs" colour="muted">
          {allEnabled ? 'Disable all' : 'Enable all'}
        </Text>
        <Switch checked={allEnabled} disabled={isLoading} size="sm" />
      </button>
    </fetcher.Form>
  )
}

const FEATURE_ICONS: Record<ModelFeature, { icon: typeof EyeIcon; label: string }> = {
  vision: { icon: EyeIcon, label: 'Vision' },
  reasoning: { icon: BrainIcon, label: 'Reasoning' },
}

function PriceTierBadge({ tier }: { tier: PriceTier }) {
  const colorClass =
    tier === '$$$$'
      ? 'text-red-500'
      : tier === '$$$'
        ? 'text-amber-500'
        : tier === '$$'
          ? 'text-emerald-500'
          : 'text-surface-400'

  return <span className={cn('text-[10px] leading-none font-semibold', colorClass)}>{tier}</span>
}

function ModelRow({
  model,
  setting,
  isConnected,
}: {
  model: {
    id: string
    name: string
    provider: Provider
    description?: string
    contextWindow?: number
    priceTier?: PriceTier
    features?: ModelFeature[]
    reasoningLevels?: ReasoningLevel[]
    versionLabel?: string
  }
  setting: UserModelSetting
  isConnected: boolean
}) {
  const fetcher = useFetcher()

  const isEnabled =
    fetcher.formData?.get('intent') === 'toggle-enabled'
      ? fetcher.formData?.get('modelId') === model.id
        ? !setting.enabled
        : setting.enabled
      : setting.enabled

  const isFavorite =
    fetcher.formData?.get('intent') === 'toggle-favorite'
      ? fetcher.formData?.get('modelId') === model.id
        ? !setting.favorite
        : setting.favorite
      : setting.favorite

  const isLoading = fetcher.state !== 'idle'
  const hasFeatures = model.features && model.features.length > 0

  return (
    <div
      className={cn(
        'group flex items-center gap-4 px-4 py-3 transition-colors',
        !isConnected && 'opacity-40',
        isEnabled ? 'bg-white' : 'bg-surface-50',
      )}
    >
      <ProviderLogo provider={model.provider} size="sm" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Text weight="medium" truncate className={cn(!isEnabled && 'text-surface-500')}>
            {model.name}
          </Text>
          {model.versionLabel && (
            <Text size="xs" colour="muted" className="shrink-0">
              ({model.versionLabel})
            </Text>
          )}
          {model.priceTier && <PriceTierBadge tier={model.priceTier} />}
          {isFavorite && <StarIcon className="h-3.5 w-3.5 text-amber-400" weight="fill" />}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          <Text size="xs" colour="muted" truncate>
            {model.description || model.id}
          </Text>
          {hasFeatures && (
            <span className="flex shrink-0 items-center gap-0.5">
              {model.features!.map((feature) => {
                const info = FEATURE_ICONS[feature]
                if (!info) return null
                const Icon = info.icon
                return (
                  <span key={feature} title={info.label} className="text-surface-300">
                    <Icon className="h-3 w-3" />
                  </span>
                )
              })}
            </span>
          )}
          {model.reasoningLevels && model.reasoningLevels.length > 0 && (
            <Text size="xs" colour="muted" className="hidden shrink-0 md:inline">
              {model.reasoningLevels.join('/')}
            </Text>
          )}
        </div>
        {model.description && (
          <Text size="xs" colour="muted" truncate className="mt-0.5">
            {model.id}
          </Text>
        )}
      </div>

      {model.contextWindow && (
        <div className="hidden sm:block">
          <Badge variant="default" size="sm">
            {(model.contextWindow / 1000).toFixed(0)}K
          </Badge>
        </div>
      )}

      <div className="flex items-center gap-2">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="toggle-favorite" />
          <input type="hidden" name="modelId" value={model.id} />
          <button
            type="submit"
            disabled={!isConnected || isLoading}
            className={cn(
              'rounded-lg p-1.5 transition-colors',
              isFavorite
                ? 'text-amber-500 hover:bg-amber-50'
                : 'text-surface-300 hover:bg-surface-100 hover:text-surface-500',
              (!isConnected || isLoading) && 'cursor-not-allowed opacity-50',
            )}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <StarIcon className="h-4 w-4" weight={isFavorite ? 'fill' : 'regular'} />
          </button>
        </fetcher.Form>

        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="toggle-enabled" />
          <input type="hidden" name="modelId" value={model.id} />
          <button type="submit" disabled={!isConnected || isLoading} className="flex items-center">
            <Switch checked={isEnabled} disabled={!isConnected || isLoading} size="sm" />
          </button>
        </fetcher.Form>
      </div>
    </div>
  )
}

export default function ModelsSettingsPage() {
  const { modelSettings, connectedProviders, cachedModels, lastRefresh } =
    useLoaderData<typeof loader>()
  const fetcher = useFetcher()
  const revalidator = useRevalidator()
  const [refreshTriggered, setRefreshTriggered] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const initialLastRefreshRef = useRef<Date | string | null>(null)
  const isRefreshing =
    fetcher.state !== 'idle' && fetcher.formData?.get('intent') === 'refresh-models'

  // Start polling when refresh action completes
  useEffect(() => {
    if (fetcher.data?.refreshing && fetcher.state === 'idle' && !refreshTriggered) {
      setRefreshTriggered(true)
      initialLastRefreshRef.current = lastRefresh
      let attempts = 0

      intervalRef.current = setInterval(() => {
        attempts++
        revalidator.revalidate()
        if (attempts >= 15) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          setRefreshTriggered(false)
        }
      }, 2000)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data?.refreshing, fetcher.state])

  // Stop polling when lastRefresh changes (models were fetched)
  useEffect(() => {
    if (refreshTriggered && lastRefresh) {
      const currentTime = new Date(lastRefresh).getTime()
      const initialTime = initialLastRefreshRef.current
        ? new Date(initialLastRefreshRef.current).getTime()
        : 0
      if (currentTime !== initialTime) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setRefreshTriggered(false)
      }
    }
  }, [lastRefresh, refreshTriggered])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterProvider, setFilterProvider] = useState<Provider | 'all'>('all')
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false)

  const allModels = useMemo(() => {
    return cachedModels.map((model) => ({
      ...model,
      provider: model.provider as Provider,
    }))
  }, [cachedModels])

  const filteredModels = useMemo(() => {
    let models = allModels

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      models = models.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.id.toLowerCase().includes(query) ||
          m.provider.toLowerCase().includes(query),
      )
    }

    if (filterProvider !== 'all') {
      models = models.filter((m) => m.provider === filterProvider)
    }

    if (showOnlyFavorites) {
      models = models.filter((m) => modelSettings[m.id]?.favorite)
    }

    // Sort: favorites first, then enabled, then alphabetically
    return models.toSorted((a, b) => {
      const aFav = modelSettings[a.id]?.favorite ?? false
      const bFav = modelSettings[b.id]?.favorite ?? false
      if (aFav !== bFav) return bFav ? 1 : -1

      const aEnabled = modelSettings[a.id]?.enabled ?? true
      const bEnabled = modelSettings[b.id]?.enabled ?? true
      if (aEnabled !== bEnabled) return bEnabled ? 1 : -1

      return a.name.localeCompare(b.name)
    })
  }, [allModels, searchQuery, filterProvider, showOnlyFavorites, modelSettings])

  const groupedModels = useMemo(() => {
    const groups: Record<Provider, typeof filteredModels> = {
      openai: [],
      anthropic: [],
      google: [],
      ollama: [],
    }

    for (const model of filteredModels) {
      groups[model.provider].push(model)
    }

    return groups
  }, [filteredModels])

  const visibleProviders =
    filterProvider === 'all'
      ? ALL_PROVIDERS
      : ALL_PROVIDERS.filter((provider) => provider === filterProvider)

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <TabHeader
        icon={CpuIcon}
        label="Models"
        description="Manage which models appear in your chats"
        iconColorClass="text-teal-500"
      />

      <div className="mb-8 flex items-center justify-end gap-2">
        <div className="flex flex-col items-end gap-2">
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="refresh-models" />
            <button
              type="submit"
              disabled={isRefreshing || refreshTriggered || connectedProviders.length === 0}
              className={cn(
                'border-surface-200 text-surface-700 hover:bg-surface-50 flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium transition-colors',
                (isRefreshing || refreshTriggered || connectedProviders.length === 0) &&
                  'cursor-not-allowed opacity-50',
              )}
            >
              <ArrowsClockwiseIcon
                className={cn('h-4 w-4', (isRefreshing || refreshTriggered) && 'animate-spin')}
              />
              {isRefreshing || refreshTriggered ? 'Fetching models...' : 'Refresh'}
            </button>
          </fetcher.Form>
          {lastRefresh && (
            <Text size="xs" colour="muted">
              Last updated: {new Date(lastRefresh).toLocaleString()}
            </Text>
          )}
          {refreshTriggered && (
            <Text size="xs" className="text-green-600">
              Fetching models from providers...
            </Text>
          )}
        </div>
      </div>

      <div className="mb-6 space-y-4">
        <Input
          placeholder="Search models..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<MagnifyingGlassIcon className="h-4 w-4" />}
          iconPosition="left"
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-surface-100 flex items-center gap-1 rounded-lg p-1">
            <button
              onClick={() => setFilterProvider('all')}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                filterProvider === 'all'
                  ? 'text-surface-900 bg-white shadow-sm'
                  : 'text-surface-600 hover:text-surface-900',
              )}
            >
              All
            </button>
            {ALL_PROVIDERS.map((provider) => (
              <button
                key={provider}
                onClick={() => setFilterProvider(provider)}
                disabled={!connectedProviders.includes(provider)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  filterProvider === provider
                    ? 'text-surface-900 bg-white shadow-sm'
                    : 'text-surface-600 hover:text-surface-900',
                  !connectedProviders.includes(provider) && 'cursor-not-allowed opacity-40',
                )}
              >
                <ProviderLogo provider={provider} size="sm" className="!h-3 !w-3" />
                {PROVIDER_NAMES[provider]}
              </button>
            ))}
          </div>

          <label className="text-surface-600 flex items-center gap-2 text-xs font-medium">
            <Switch size="sm" checked={showOnlyFavorites} onChange={setShowOnlyFavorites} />
            Favorites only
          </label>
        </div>
      </div>

      {connectedProviders.length === 0 && (
        <Alert variant="warning" title="No providers connected" className="mb-6">
          Connect at least one provider in the{' '}
          <Link to="/settings/connections" className="font-medium underline">
            Connections
          </Link>{' '}
          tab to see available models.
        </Alert>
      )}

      <div className="space-y-6">
        {visibleProviders.map((provider) => {
          const models = groupedModels[provider]
          const isConnected = connectedProviders.includes(provider)

          if (models.length === 0 && !isConnected) return null

          return (
            <section key={provider}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ProviderLogo provider={provider} size="md" showBackground />
                  <Text weight="semibold">
                    {PROVIDER_NAMES[provider]}{' '}
                    <span className="text-surface-500 font-normal">
                      ({models.length} model{models.length !== 1 ? 's' : ''})
                    </span>
                    {!isConnected && (
                      <span className="text-surface-400 font-normal"> • Not connected</span>
                    )}
                  </Text>
                </div>
                {isConnected && models.length > 0 && (
                  <ProviderToggle
                    provider={provider}
                    models={models}
                    modelSettings={modelSettings}
                  />
                )}
              </div>

              <Panel className="overflow-hidden p-0">
                {models.length > 0 ? (
                  <div className="divide-surface-100 divide-y">
                    {models.map((model) => (
                      <ModelRow
                        key={model.id}
                        model={model}
                        setting={
                          modelSettings[model.id] || {
                            modelId: model.id,
                            enabled: true,
                            favorite: false,
                            customName: null,
                          }
                        }
                        isConnected={isConnected}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    {provider === 'ollama' ? (
                      <>
                        <Text as="p" colour="muted">
                          No Ollama models found
                        </Text>
                        <Text as="p" size="sm" colour="muted" className="mt-1">
                          Pull a model in Ollama, then refresh models.
                        </Text>
                      </>
                    ) : (
                      <Text colour="muted">No models found</Text>
                    )}
                  </div>
                )}
              </Panel>
            </section>
          )
        })}
      </div>

      {/* {filteredModels.length === 0 && connectedProviders.length > 0 && (
        <div className="border-surface-300 rounded-xl border border-dashed p-12 text-center">
          <MagnifyingGlassIcon className="text-surface-300 mx-auto h-12 w-12" />
          <Text as="p" size="lg" weight="medium" className="mt-4">
            No models found
          </Text>
          <Text colour="muted" className="mt-1">
            Try adjusting your search or filters
          </Text>
        </div>
      )} */}
    </div>
  )
}
