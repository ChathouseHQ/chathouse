import { decrypt, type ModelRefreshJobData } from '@chathouse/database'
import { createLogger } from '@chathouse/logger'
import { Job } from 'bullmq'

import { db } from '../config.js'
import { formatModelName, isGoogleChatModelId, isOpenAIModelId } from '../utils.js'

const logger = createLogger('worker:refresh')

async function fetchOpenAIModels(apiKey: string): Promise<string[]> {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!response.ok) {
    throw new Error(`OpenAI model list request failed with ${response.status}`)
  }

  const data = (await response.json()) as { data?: Array<{ id: string }> }
  return (data.data ?? []).filter((m) => isOpenAIModelId(m.id)).map((m) => m.id)
}

async function fetchAnthropicModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    })
    if (!response.ok) return []
    const data = (await response.json()) as { data?: Array<{ id: string }> }
    return data.data?.map((m) => m.id) || []
  } catch {
    return []
  }
}

async function fetchGoogleModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    )
    if (!response.ok) return []
    const data = (await response.json()) as {
      models?: Array<{ name: string }>
    }
    return data.models?.map((m) => m.name.replace('models/', '')).filter(isGoogleChatModelId) || []
  } catch {
    return []
  }
}

async function refreshModelsForUser(userId: string, specificProvider?: string): Promise<number> {
  const apiKeys = await db.apiKey.findMany({
    where: {
      userId,
      ...(specificProvider && { provider: specificProvider }),
    },
    select: { provider: true, encryptedKey: true },
  })

  const refreshedProviders = new Set<string>()
  const allModels: Array<{
    modelId: string
    provider: string
    name: string
  }> = []

  for (const { provider, encryptedKey } of apiKeys) {
    let apiKey: string

    try {
      apiKey = decrypt(encryptedKey)
    } catch {
      logger.error(
        `Failed to decrypt API key for ${provider} (user: ${userId}). ` +
          `This usually means SECRET_KEY_BASE changed since the key was saved.`,
      )
      continue
    }

    try {
      let modelIds: string[] = []

      switch (provider) {
        case 'openai':
          modelIds = await fetchOpenAIModels(apiKey)
          break
        case 'anthropic':
          modelIds = await fetchAnthropicModels(apiKey)
          break
        case 'google':
          modelIds = await fetchGoogleModels(apiKey)
          break
      }

      refreshedProviders.add(provider)

      for (const modelId of modelIds) {
        allModels.push({
          modelId,
          provider,
          name: formatModelName(modelId),
        })
      }
    } catch (reason) {
      logger.error(`Error fetching models from ${provider}:`, reason)
    }
  }

  for (const provider of refreshedProviders) {
    await db.cachedModel.deleteMany({
      where: { userId, provider },
    })

    const providerModels = allModels.filter((model) => model.provider === provider)
    if (providerModels.length === 0) continue

    await db.cachedModel.createMany({
      data: providerModels.map((m) => ({
        userId,
        modelId: m.modelId,
        provider: m.provider,
        name: m.name,
      })),
      skipDuplicates: true,
    })
  }

  return allModels.length
}

export async function processModelRefreshJob(job: Job<ModelRefreshJobData>) {
  const { userId, provider: specificProvider } = job.data

  if (userId === '__all__') {
    try {
      const usersWithKeys = await db.apiKey.findMany({
        select: { userId: true },
        distinct: ['userId'],
      })

      for (const { userId: uid } of usersWithKeys) {
        try {
          await refreshModelsForUser(uid)
        } catch (reason) {
          logger.error(`Error refreshing models for user ${uid}:`, reason)
        }
      }
    } catch (reason) {
      logger.error('Error in periodic model refresh:', reason)
      throw reason
    }
    return
  }

  try {
    await refreshModelsForUser(userId, specificProvider)
  } catch (reason) {
    logger.error(`Error in model refresh for user ${userId}:`, reason)
    throw reason
  }
}
