import type { ChatJobData, TitleJobData } from '@chathouse/database'

import { createLogger } from '@chathouse/logger'
import { generateText, type ModelMessage } from 'ai'
import { Job } from 'bullmq'

import { db } from '../config.js'
import {
  createLanguageModelForProvider,
  getApiKey,
  streamAIResponse,
  DEFAULT_TITLE_CHAR_LIMIT,
  loadFileContent,
  buildMultimodalContent,
} from '../utils.js'

const logger = createLogger('worker:chat')

export async function processChatJob(job: Job<ChatJobData>) {
  const { messageId, chatId, userId, content, model, systemPrompt, fileIds, reasoningEffort } =
    job.data

  try {
    await db.message.update({
      where: { id: messageId },
      data: { status: 'processing' },
    })

    const previousMessages = await db.message.findMany({
      where: {
        chatId,
        status: 'complete',
        NOT: { id: messageId },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        role: true,
        content: true,
        files: {
          select: { id: true, storedName: true, mimeType: true },
        },
      },
    })

    const messages: ModelMessage[] = []
    for (const m of previousMessages) {
      if (m.role === 'user' && m.files.length > 0) {
        const fileBuffers = await Promise.all(
          m.files.map(async (f: any) => ({
            buffer: await loadFileContent(f),
            mimeType: f.mimeType,
          })),
        )
        messages.push({
          role: 'user',
          content: buildMultimodalContent(m.content, fileBuffers),
        })
      } else {
        messages.push({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })
      }
    }

    if (fileIds && fileIds.length > 0) {
      const currentFiles = await db.file.findMany({
        where: { id: { in: fileIds }, userId },
        select: { id: true, storedName: true, mimeType: true },
      })
      const fileBuffers = await Promise.all(
        currentFiles.map(async (f: any) => ({
          buffer: await loadFileContent(f),
          mimeType: f.mimeType,
        })),
      )
      messages.push({
        role: 'user',
        content: buildMultimodalContent(content, fileBuffers),
      })
    } else {
      messages.push({ role: 'user', content })
    }

    let lastDbUpdate = 0
    const DB_UPDATE_INTERVAL = 500

    const response = await streamAIResponse(
      userId,
      model,
      messageId,
      messages,
      systemPrompt,
      async (fullContent) => {
        const now = Date.now()
        if (now - lastDbUpdate > DB_UPDATE_INTERVAL) {
          lastDbUpdate = now
          await db.message.update({
            where: { id: messageId },
            data: { content: fullContent },
          })
        }
      },
      reasoningEffort,
    )

    await db.message.update({
      where: { id: messageId },
      data: {
        content: response,
        status: 'complete',
      },
    })
  } catch (reason) {
    logger.error(`Error in chat job ${messageId}:`, reason)

    await db.message.update({
      where: { id: messageId },
      data: {
        status: 'error',
        error: reason instanceof Error ? reason.message : 'Unknown error',
      },
    })

    throw reason
  }
}

const TITLE_MODELS: Array<{ modelId: string; provider: 'openai' | 'anthropic' | 'google' }> = [
  { modelId: 'gemini-3.1-flash-lite-preview', provider: 'google' },
  { modelId: 'gpt-5.4-nano', provider: 'openai' },
  { modelId: 'claude-haiku-4-5', provider: 'anthropic' },
]

async function getOllamaTitleModels(userId: string): Promise<string[]> {
  const models = await db.cachedModel.findMany({
    where: { userId, provider: 'ollama' },
    select: { modelId: true },
  })

  if (models.length === 0) return []

  const settings = await db.enabledModel.findMany({
    where: { userId, modelId: { in: models.map((model) => model.modelId) } },
    select: { modelId: true, enabled: true, favorite: true },
  })
  const settingsMap = new Map(settings.map((setting) => [setting.modelId, setting]))

  return models
    .filter((model) => settingsMap.get(model.modelId)?.enabled ?? true)
    .toSorted((a, b) => {
      const aFavorite = settingsMap.get(a.modelId)?.favorite ?? false
      const bFavorite = settingsMap.get(b.modelId)?.favorite ?? false
      if (aFavorite !== bFavorite) return bFavorite ? 1 : -1
      return a.modelId.localeCompare(b.modelId)
    })
    .map((model) => model.modelId)
}

export async function processTitleJob(job: Job<TitleJobData>) {
  const { chatId, userId, firstMessage, strategy } = job.data

  try {
    let title = ''

    if (strategy === 'first_chars') {
      title = firstMessage.slice(0, DEFAULT_TITLE_CHAR_LIMIT).trim()
      if (firstMessage.length > DEFAULT_TITLE_CHAR_LIMIT) title += '...'
    } else {
      let generated = false

      for (const { modelId, provider } of TITLE_MODELS) {
        const apiKey = await getApiKey(userId, provider)
        if (!apiKey) continue

        try {
          const aiModel = await createLanguageModelForProvider(userId, provider, modelId)

          const result = await generateText({
            model: aiModel,
            messages: [
              {
                role: 'user',
                content: `Generate a very short title (4-6 words max) for a chat that starts with this message. Return ONLY the title, no quotes or punctuation:\n\n${firstMessage.slice(0, 500)}`,
              },
            ],
          })

          title = result.text.trim().slice(0, 100)
          generated = true
          break
        } catch {
          continue
        }
      }

      if (!generated) {
        for (const modelId of await getOllamaTitleModels(userId)) {
          try {
            const aiModel = await createLanguageModelForProvider(userId, 'ollama', modelId)
            const result = await generateText({
              model: aiModel,
              messages: [
                {
                  role: 'user',
                  content: `Generate a very short title (4-6 words max) for a chat that starts with this message. Return ONLY the title, no quotes or punctuation:\n\n${firstMessage.slice(0, 500)}`,
                },
              ],
            })

            title = result.text.trim().slice(0, 100)
            generated = true
            break
          } catch {
            continue
          }
        }
      }

      if (!generated) {
        title = firstMessage.slice(0, 50).trim() + (firstMessage.length > 50 ? '...' : '')
      }
    }

    await db.chat.update({
      where: { id: chatId },
      data: { title },
    })
  } catch (reason) {
    logger.error(`Error in title job for chat ${chatId}:`, reason)
  }
}
