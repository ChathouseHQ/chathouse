import type { ChatJobData, TitleJobData, ModelRefreshJobData } from '@chathouse/database'

import { createLogger } from '@chathouse/logger'
import { Worker, Queue, type ConnectionOptions } from 'bullmq'

import { redis, redisOptions, db } from './config'
import { processChatJob, processTitleJob } from './processors/chat'
import { processModelRefreshJob } from './processors/refresh'

const logger = createLogger('worker')
let modelRefreshQueue: Queue<ModelRefreshJobData> | undefined
let shutdownPromise: Promise<void> | undefined

function createConnection(): ConnectionOptions {
  return redis.duplicate(redisOptions) as unknown as ConnectionOptions
}

const chatWorker = new Worker<ChatJobData>('chat', processChatJob, {
  connection: createConnection(),
  concurrency: 100,
})

const titleWorker = new Worker<TitleJobData>('title', processTitleJob, {
  connection: createConnection(),
  concurrency: 100,
})

const modelRefreshWorker = new Worker<ModelRefreshJobData>(
  'model-refresh',
  async (job) => {
    logger.info(`Received job ${job.id} (name: ${job.name})`)
    try {
      await processModelRefreshJob(job)
      logger.info(`Finished job ${job.id}`)
    } catch (reason) {
      logger.error(`Error in job ${job.id}:`, reason)
      throw reason
    }
  },
  {
    connection: createConnection(),
    concurrency: 20,
  },
)

const workers = [
  { name: 'Chat', worker: chatWorker },
  { name: 'Title', worker: titleWorker },
  { name: 'Model Refresh', worker: modelRefreshWorker },
]

workers.forEach(({ name, worker }) => {
  worker.on('active', (job) => {
    logger.info(`${name} job ${job.id} is now active`)
  })

  worker.on('completed', (job) => {
    logger.info(`${name} job ${job.id} completed`)
  })

  worker.on('failed', (job, error) => {
    logger.error(`${name} job ${job?.id} failed:`, error.message)
  })

  worker.on('error', (err) => {
    logger.error(`${name} worker error:`, err)
  })
})

async function setupPeriodicModelRefresh() {
  modelRefreshQueue = new Queue('model-refresh', {
    connection: redis as unknown as ConnectionOptions,
  })

  await modelRefreshQueue.add(
    'periodic-refresh',
    { userId: '__all__' },
    {
      repeat: {
        pattern: '0 * * * *', // Every hour at minute 0
      },
      jobId: 'periodic-model-refresh',
    },
  )

  logger.info('Periodic model refresh scheduled (every hour)')
}

setupPeriodicModelRefresh().catch((error) => {
  logger.error('Failed to schedule periodic model refresh:', error)
})

async function shutdown(signal: 'SIGINT' | 'SIGTERM') {
  if (shutdownPromise) {
    return shutdownPromise
  }

  shutdownPromise = (async () => {
    logger.info(`Shutting down workers after ${signal}...`)
    const forceExitTimer = setTimeout(() => {
      logger.error('Worker shutdown timed out, exiting forcefully.')
      process.exit(0)
    }, 1000)
    forceExitTimer.unref()

    const results = await Promise.allSettled([
      chatWorker.close(true),
      titleWorker.close(true),
      modelRefreshWorker.close(true),
      modelRefreshQueue?.close(),
      db.$disconnect(),
    ])

    clearTimeout(forceExitTimer)
    redis.disconnect()

    const rejected = results.filter((result) => result.status === 'rejected')
    if (rejected.length > 0) {
      for (const result of rejected) {
        logger.error('Error during worker shutdown:', result.reason)
      }
      process.exit(1)
      return
    }

    process.exit(0)
  })()

  return shutdownPromise
}

process.once('SIGTERM', () => {
  void shutdown('SIGTERM')
})
process.once('SIGINT', () => {
  void shutdown('SIGINT')
})

logger.info('Workers started. Waiting for jobs...')
