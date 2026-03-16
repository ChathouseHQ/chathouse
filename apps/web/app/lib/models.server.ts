import type { Provider } from '@chathouse/database'

import { db } from './db.server'
import { type ModelInfo } from './models'

export interface UserModelSetting {
  modelId: string
  enabled: boolean
  favorite: boolean
  customName: string | null
}

export interface EnrichedModel extends ModelInfo {
  enabled: boolean
  favorite: boolean
  customName: string | null
}

async function getConnectedProviders(userId: string): Promise<Set<Provider>> {
  const apiKeys = await db.apiKey.findMany({
    where: { userId },
    select: { provider: true },
  })
  return new Set(apiKeys.map((k) => k.provider as Provider))
}

export async function getCachedModels(userId: string): Promise<{
  models: Array<{ id: string; provider: Provider; name: string }>
  lastRefresh: Date | null
}> {
  const cachedModels = await db.cachedModel.findMany({
    where: { userId },
    orderBy: { fetchedAt: 'desc' },
  })

  const lastRefresh = cachedModels.length > 0 ? cachedModels[0].fetchedAt : null

  return {
    models: cachedModels.map((m) => ({
      id: m.modelId,
      provider: m.provider as Provider,
      name: m.name,
    })),
    lastRefresh,
  }
}

async function getEnabledModels(userId: string): Promise<EnrichedModel[]> {
  const settings = await db.enabledModel.findMany({
    where: { userId },
    select: { modelId: true, enabled: true, favorite: true, customName: true },
  })

  type SettingRow = (typeof settings)[number]
  const settingsMap = new Map<string, SettingRow>(settings.map((s) => [s.modelId, s]))

  const { models: cachedModels } = await getCachedModels(userId)

  const models: EnrichedModel[] = cachedModels.map((m) => {
    const setting = settingsMap.get(m.id)
    return {
      ...m,
      contextWindow: 0,
      description: '',
      enabled: setting?.enabled ?? true,
      favorite: setting?.favorite ?? false,
      customName: setting?.customName ?? null,
    }
  })

  // Sort: favorites first, then by provider, then by name
  return models.toSorted((a, b) => {
    if (a.favorite !== b.favorite) return b.favorite ? 1 : -1
    if (a.provider !== b.provider) return a.provider.localeCompare(b.provider)
    return a.name.localeCompare(b.name)
  })
}

export async function getUserModelSettings(
  userId: string,
): Promise<Record<string, UserModelSetting>> {
  const settings = await db.enabledModel.findMany({
    where: { userId },
    select: { modelId: true, enabled: true, favorite: true, customName: true },
  })

  const result: Record<string, UserModelSetting> = {}

  // Apply user settings - models default to enabled if no setting exists
  for (const setting of settings) {
    result[setting.modelId] = {
      modelId: setting.modelId,
      enabled: setting.enabled,
      favorite: setting.favorite,
      customName: setting.customName,
    }
  }

  return result
}

export async function toggleModelEnabled(userId: string, modelId: string): Promise<boolean> {
  const existing = await db.enabledModel.findUnique({
    where: { userId_modelId: { userId, modelId } },
  })

  const newEnabled = !(existing?.enabled ?? true)

  await db.enabledModel.upsert({
    where: { userId_modelId: { userId, modelId } },
    create: { userId, modelId, enabled: newEnabled },
    update: { enabled: newEnabled },
  })

  return newEnabled
}

export async function toggleModelFavorite(userId: string, modelId: string): Promise<boolean> {
  const existing = await db.enabledModel.findUnique({
    where: { userId_modelId: { userId, modelId } },
  })

  const newFavorite = !(existing?.favorite ?? false)

  await db.enabledModel.upsert({
    where: { userId_modelId: { userId, modelId } },
    create: { userId, modelId, favorite: newFavorite },
    update: { favorite: newFavorite },
  })

  return newFavorite
}

export async function setProviderModelsEnabled(
  userId: string,
  modelIds: string[],
  enabled: boolean,
): Promise<void> {
  await db.$transaction(
    modelIds.map((modelId) =>
      db.enabledModel.upsert({
        where: { userId_modelId: { userId, modelId } },
        create: { userId, modelId, enabled },
        update: { enabled },
      }),
    ),
  )
}

// Get models for selector with additional metadata for empty state handling
export async function getModelsForSelectorWithMeta(userId: string): Promise<{
  models: EnrichedModel[]
  hasConnections: boolean
  totalModelsCount: number
  connectedProviders: Provider[]
}> {
  const allModels = await getEnabledModels(userId)
  const enabledModels = allModels.filter((m) => m.enabled)
  const connectedProviders = await getConnectedProviders(userId)

  return {
    models: enabledModels,
    hasConnections: connectedProviders.size > 0,
    totalModelsCount: allModels.length,
    connectedProviders: [...connectedProviders],
  }
}
