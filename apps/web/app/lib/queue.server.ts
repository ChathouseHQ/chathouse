import type { ChatJobData, TitleJobData, ModelRefreshJobData } from '@chathouse/database'

import { createLogger } from '@chathouse/logger'
import { Queue, type ConnectionOptions } from 'bullmq'

import { redis } from './redis.server'

const connection = redis as unknown as ConnectionOptions

const logger = createLogger('web:queue')

declare global {
  var __chatQueue: Queue<ChatJobData> | undefined
  var __titleQueue: Queue<TitleJobData> | undefined
  var __modelRefreshQueue: Queue<ModelRefreshJobData> | undefined
}

function createChatQueue() {
  return new Queue<ChatJobData>('chat', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  })
}

function createTitleQueue() {
  return new Queue<TitleJobData>('title', {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 500,
      },
      removeOnComplete: 50,
      removeOnFail: 50,
    },
  })
}

function createModelRefreshQueue() {
  return new Queue<ModelRefreshJobData>('model-refresh', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  })
}

const chatQueue = globalThis.__chatQueue ?? createChatQueue()
const titleQueue = globalThis.__titleQueue ?? createTitleQueue()
const modelRefreshQueue = globalThis.__modelRefreshQueue ?? createModelRefreshQueue()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__chatQueue = chatQueue
  globalThis.__titleQueue = titleQueue
  globalThis.__modelRefreshQueue = modelRefreshQueue
}

export async function addChatJob(data: ChatJobData) {
  const existingJob = await chatQueue.getJob(data.messageId)
  if (existingJob) {
    try {
      await existingJob.remove()
    } catch {
      // Job may be active or locked - safe to ignore
    }
  }
  return chatQueue.add('process', data, {
    jobId: data.messageId,
  })
}

export async function addTitleJob(data: TitleJobData) {
  return titleQueue.add('generate', data, {
    jobId: `title-${data.chatId}`,
  })
}

export async function addModelRefreshJob(data: ModelRefreshJobData) {
  const jobId = data.provider ? `refresh-${data.userId}-${data.provider}` : `refresh-${data.userId}`

  try {
    const job = await modelRefreshQueue.add('refresh', data, {
      jobId,
    })
    return job
  } catch (reason) {
    logger.error('Failed to add model refresh job:', reason)
    throw reason
  }
}
