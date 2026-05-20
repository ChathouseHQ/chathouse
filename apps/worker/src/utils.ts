import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { decrypt, getModelMetadata, type Provider, type ReasoningLevel } from '@chathouse/database'
import { createLogger } from '@chathouse/logger'
import { stepCountIs, streamText, type ModelMessage, type UserContent } from 'ai'
import { existsSync } from 'fs'
import * as fs from 'fs/promises'
import * as path from 'path'

import { db, redis } from './config.js'
import { resolveProviderForModelId } from './model-utils.js'
import { OLLAMA_DEFAULT_BASE_URL } from './ollama.js'
import { buildCalculatorTools } from './tools/calculator.js'
import { buildDateTimeTools } from './tools/date-time.js'
import { buildPageReaderTools } from './tools/page-reader.js'
import {
  buildWebSearchTools,
  type WebSearchError,
  type WebSearchSource,
  type WebSearchToolEvent,
} from './tools/web-search.js'

const logger = createLogger('worker:utils')

function resolveUploadDir(): string {
  if (process.env.UPLOAD_DIR) return process.env.UPLOAD_DIR

  let dir = process.cwd()
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, 'turbo.json'))) {
      return path.join(dir, 'data', 'uploads')
    }
    dir = path.dirname(dir)
  }

  return path.join(process.cwd(), 'data', 'uploads')
}

const UPLOAD_DIR = resolveUploadDir()

export const DEFAULT_TITLE_CHAR_LIMIT = 20

const BASE_SYSTEM_PROMPT = `You are a helpful AI assistant. When responding:
- Use markdown formatting to structure your responses clearly
- Use **bold** for emphasis on important terms
- Use \`code\` for inline code and \`\`\` for code blocks with language specification
- Use bullet points or numbered lists when listing items
- Use headers (##, ###) to organize longer responses
- Use > for quotes when relevant
- Keep responses concise but comprehensive`

const TOOL_SYSTEM_PROMPT = [
  '',
  '',
  'Tools are available for web research, page reading, exact arithmetic, unit conversion, and date/time work. Use tools when they improve accuracy: search the web for current, fast-changing, source-sensitive, or precisely attributable information; open specific public URLs when the user provides a link or a search result needs closer reading; use calculator/date tools for exact math, conversions, current time, and calendar calculations. Do not use tools for simple stable facts, creative writing, or information already provided by the user. When web search or page reading influenced the answer, cite the source URLs in markdown. If a tool fails or returns no relevant results, say that briefly instead of inventing evidence.',
].join('\n')

async function getProviderForModel(userId: string, modelId: string): Promise<Provider | undefined> {
  const cachedModel = await db.cachedModel.findUnique({
    where: { userId_modelId: { userId, modelId } },
    select: { provider: true },
  })

  return resolveProviderForModelId(modelId, cachedModel?.provider)
}

export async function getApiKey(userId: string, provider: Provider): Promise<string | null> {
  const apiKey = await db.apiKey.findUnique({
    where: { userId_provider: { userId, provider } },
  })
  if (!apiKey?.encryptedKey) return null
  try {
    return decrypt(apiKey.encryptedKey)
  } catch {
    return null
  }
}

async function getProviderConnection(
  userId: string,
  provider: Provider,
): Promise<{ apiKey?: string; baseUrl?: string } | null> {
  const connection = await db.apiKey.findUnique({
    where: { userId_provider: { userId, provider } },
  })

  if (!connection) return null

  let apiKey: string | undefined
  if (connection.encryptedKey) {
    try {
      apiKey = decrypt(connection.encryptedKey)
    } catch {
      logger.error(
        `Failed to decrypt API key for ${provider}. ` +
          `This usually means SECRET_KEY_BASE changed since the key was saved.`,
      )
      if (provider !== 'ollama') return null
    }
  }

  if (provider !== 'ollama' && !apiKey) return null

  return {
    ...(apiKey ? { apiKey } : {}),
    ...(connection.baseUrl ? { baseUrl: connection.baseUrl } : {}),
  }
}

export async function createLanguageModelForProvider(
  userId: string,
  provider: Provider,
  modelId: string,
) {
  const connection = await getProviderConnection(userId, provider)

  switch (provider) {
    case 'openai': {
      if (!connection?.apiKey) throw new Error('No API key configured for openai')
      const openai = createOpenAI({ apiKey: connection.apiKey })
      return openai(modelId)
    }
    case 'anthropic': {
      if (!connection?.apiKey) throw new Error('No API key configured for anthropic')
      const anthropic = createAnthropic({ apiKey: connection.apiKey })
      return anthropic(modelId)
    }
    case 'google': {
      if (!connection?.apiKey) throw new Error('No API key configured for google')
      const google = createGoogleGenerativeAI({ apiKey: connection.apiKey })
      return google(modelId)
    }
    case 'ollama': {
      if (!connection) throw new Error('No Ollama connection configured')
      const ollama = createOpenAICompatible({
        name: 'ollama',
        baseURL: connection.baseUrl || OLLAMA_DEFAULT_BASE_URL,
        apiKey: connection.apiKey,
      })
      return ollama(modelId)
    }
  }
}

interface FileAttachment {
  id: string
  storedName: string
  mimeType: string
}

export async function loadFileContent(file: FileAttachment): Promise<Buffer> {
  const filePath = path.join(UPLOAD_DIR, file.storedName)
  return fs.readFile(filePath)
}

export function buildMultimodalContent(
  text: string,
  files: Array<{ buffer: Buffer; mimeType: string }>,
): UserContent {
  const parts: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; image: Buffer }
    | { type: 'file'; data: Buffer; mimeType: string }
  > = []

  for (const file of files) {
    if (file.mimeType.startsWith('image/')) {
      parts.push({ type: 'image', image: file.buffer })
    } else {
      parts.push({ type: 'file', data: file.buffer, mimeType: file.mimeType })
    }
  }

  parts.push({ type: 'text', text })

  return parts as UserContent
}

function getStreamChannel(messageId: string): string {
  return `stream:${messageId}`
}

interface StreamChunk {
  type: 'delta' | 'done' | 'error' | 'webSearch'
  content?: string
  error?: string
  webSearch?: WebSearchActivity
}

interface WebSearchActivity {
  id: string
  query: string
  status: 'searching' | 'complete' | 'error'
  sources: WebSearchSource[]
  error?: WebSearchError
  startedAt: string
  completedAt?: string
}

type StreamTextOptions = Parameters<typeof streamText>[0]

function buildProviderOptions(
  provider: Provider,
  modelId: string,
  reasoningEffort?: ReasoningLevel,
): StreamTextOptions['providerOptions'] {
  if (!reasoningEffort) return undefined

  const meta = getModelMetadata(modelId)
  if (!meta?.reasoningLevels?.includes(reasoningEffort)) return undefined

  switch (provider) {
    case 'openai':
      return { openai: { reasoningEffort } }
    case 'anthropic': {
      if (usesAnthropicAdaptiveThinking(modelId)) {
        const effort =
          reasoningEffort === 'xhigh'
            ? 'max'
            : reasoningEffort === 'minimal'
              ? 'low'
              : reasoningEffort
        return {
          anthropic: {
            thinking: { type: 'adaptive' },
            effort,
          },
        }
      }

      if (reasoningEffort === 'minimal' || reasoningEffort === 'xhigh') return undefined

      const budgetMap: Record<ReasoningLevel, number> = {
        minimal: 1024,
        low: 4096,
        medium: 10_000,
        high: 32_000,
        xhigh: 64_000,
      }
      return {
        anthropic: {
          thinking: { type: 'enabled', budgetTokens: budgetMap[reasoningEffort] },
        },
      }
    }
    case 'google': {
      if (reasoningEffort === 'xhigh') return undefined

      if (modelId.toLowerCase().startsWith('gemini-3')) {
        return {
          google: {
            thinkingConfig: {
              thinkingLevel: reasoningEffort === 'minimal' ? 'minimal' : reasoningEffort,
            },
          },
        }
      }

      if (reasoningEffort === 'minimal') return undefined

      const budgetMap: Record<ReasoningLevel, number> = {
        minimal: 1024,
        low: 2048,
        medium: 8192,
        high: 32_768,
        xhigh: 65_536,
      }
      return {
        google: {
          thinkingConfig: { thinkingBudget: budgetMap[reasoningEffort] },
        },
      }
    }
    case 'ollama':
      return undefined
  }
}

function usesAnthropicAdaptiveThinking(modelId: string): boolean {
  const id = modelId.toLowerCase()
  return (
    id.startsWith('claude-opus-4-7') ||
    id.startsWith('claude-opus-4-6') ||
    id.startsWith('claude-sonnet-4-6')
  )
}

async function saveMessageWebSearches(
  messageId: string,
  webSearches: WebSearchActivity[],
): Promise<void> {
  const value = webSearches.length > 0 ? JSON.stringify(webSearches) : null
  try {
    await db.$executeRaw`UPDATE messages SET webSearches = ${value} WHERE id = ${messageId}`
  } catch {
    // Web search metadata should not block the model response if migrations lag behind the worker.
  }
}

function mergeWebSearchEvent(
  existingSearches: WebSearchActivity[],
  event: WebSearchToolEvent,
): WebSearchActivity[] {
  const now = new Date().toISOString()
  const index = existingSearches.findIndex((item) => item.id === event.id)
  const previous = index >= 0 ? existingSearches[index] : undefined
  const next: WebSearchActivity = {
    id: event.id,
    query: event.query,
    status: event.status,
    sources: event.sources,
    ...(event.error ? { error: event.error } : {}),
    startedAt: previous?.startedAt ?? now,
    ...(event.status === 'searching' ? {} : { completedAt: now }),
  }

  if (index === -1) return [...existingSearches, next]

  const merged = [...existingSearches]
  merged[index] = next
  return merged
}

export async function streamAIResponse(
  userId: string,
  modelId: string,
  messageId: string,
  messages: ModelMessage[],
  userSystemPrompt?: string,
  onChunk?: (fullContent: string) => Promise<void>,
  reasoningEffort?: ReasoningLevel,
): Promise<string> {
  const provider = await getProviderForModel(userId, modelId)
  if (!provider) throw new Error(`Unknown model: ${modelId}`)

  const connection = await getProviderConnection(userId, provider)
  if (!connection) throw new Error(`No connection configured for ${provider}`)
  if (provider !== 'ollama' && !connection.apiKey) {
    throw new Error(`No API key configured for ${provider}`)
  }

  let webSearches: WebSearchActivity[] = []
  await saveMessageWebSearches(messageId, webSearches)

  const channel = getStreamChannel(messageId)
  const publishWebSearch = async (event: WebSearchToolEvent) => {
    webSearches = mergeWebSearchEvent(webSearches, event)
    const webSearch = webSearches.find((item) => item.id === event.id)
    if (!webSearch) return

    try {
      await saveMessageWebSearches(messageId, webSearches)
      const streamChunk: StreamChunk = { type: 'webSearch', webSearch }
      await redis.publish(channel, JSON.stringify(streamChunk))
    } catch {
      // Search UI events are best-effort; the answer should keep streaming.
    }
  }

  const webSearchTools = buildWebSearchTools({ onEvent: publishWebSearch })
  const tools = {
    ...buildCalculatorTools(),
    ...buildDateTimeTools(),
    ...buildPageReaderTools(),
    ...webSearchTools,
  }
  const combinedSystemPrompt = userSystemPrompt
    ? `${BASE_SYSTEM_PROMPT}${TOOL_SYSTEM_PROMPT}\n\nAdditional instructions from user:\n${userSystemPrompt}`
    : `${BASE_SYSTEM_PROMPT}${TOOL_SYSTEM_PROMPT}`

  const allMessages = [{ role: 'system' as const, content: combinedSystemPrompt }, ...messages]

  const model = await createLanguageModelForProvider(userId, provider, modelId)

  const providerOptions = buildProviderOptions(provider, modelId, reasoningEffort)
  let fullContent = ''

  try {
    const result = streamText({
      model,
      messages: allMessages,
      providerOptions,
      tools,
      toolChoice: 'auto',
      stopWhen: stepCountIs(6),
    })

    for await (const chunk of result.textStream) {
      fullContent += chunk

      const streamChunk: StreamChunk = { type: 'delta', content: chunk }
      await redis.publish(channel, JSON.stringify(streamChunk))

      if (onChunk) {
        await onChunk(fullContent)
      }
    }

    const doneChunk: StreamChunk = { type: 'done' }
    await redis.publish(channel, JSON.stringify(doneChunk))

    return fullContent
  } catch (reason) {
    const errorChunk: StreamChunk = {
      type: 'error',
      error: reason instanceof Error ? reason.message : 'Unknown error',
    }
    await redis.publish(channel, JSON.stringify(errorChunk))
    throw reason
  }
}

export { formatModelName, isGoogleChatModelId, isOpenAIModelId } from './model-utils.js'
