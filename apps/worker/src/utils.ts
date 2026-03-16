import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { decrypt, type Provider } from '@chathouse/database'
import { streamText, type ModelMessage, type UserContent } from 'ai'
import { existsSync } from 'fs'
import * as fs from 'fs/promises'
import * as path from 'path'

import { db, redis } from './config'

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

export function isOpenAIModelId(modelId: string): boolean {
  const id = modelId.toLowerCase()
  return id.startsWith('gpt-') || /^o\d/.test(id) || id.startsWith('chatgpt')
}

function getProviderForModel(modelId: string): Provider | undefined {
  const id = modelId.toLowerCase()

  if (isOpenAIModelId(id)) {
    return 'openai'
  }

  if (id.startsWith('claude')) {
    return 'anthropic'
  }

  if (id.startsWith('gemini')) {
    return 'google'
  }

  return undefined
}

export async function getApiKey(userId: string, provider: Provider): Promise<string | null> {
  const apiKey = await db.apiKey.findUnique({
    where: { userId_provider: { userId, provider } },
  })
  if (!apiKey) return null
  try {
    return decrypt(apiKey.encryptedKey)
  } catch {
    return null
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
  type: 'delta' | 'done' | 'error'
  content?: string
  error?: string
}

export async function streamAIResponse(
  userId: string,
  modelId: string,
  messageId: string,
  messages: ModelMessage[],
  userSystemPrompt?: string,
  onChunk?: (fullContent: string) => Promise<void>,
): Promise<string> {
  const provider = getProviderForModel(modelId)
  if (!provider) throw new Error(`Unknown model: ${modelId}`)

  const apiKey = await getApiKey(userId, provider)
  if (!apiKey) throw new Error(`No API key configured for ${provider}`)

  const combinedSystemPrompt = userSystemPrompt
    ? `${BASE_SYSTEM_PROMPT}\n\nAdditional instructions from user:\n${userSystemPrompt}`
    : BASE_SYSTEM_PROMPT

  const allMessages = [{ role: 'system' as const, content: combinedSystemPrompt }, ...messages]

  let model
  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({ apiKey })
      model = openai(modelId)
      break
    }
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey })
      model = anthropic(modelId)
      break
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey })
      model = google(modelId)
      break
    }
  }

  const channel = getStreamChannel(messageId)
  let fullContent = ''

  try {
    const result = streamText({ model, messages: allMessages })

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

export function formatModelName(modelId: string): string {
  return modelId
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Gpt/g, 'GPT')
    .replace(/Gemini/g, 'Gemini')
    .replace(/Claude/g, 'Claude')
    .replace(/ Latest$/i, '')
    .replace(/(\d{8})$/, '')
}
