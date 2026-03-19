import { config } from 'dotenv'
config({ path: '../../.env', quiet: true })

import { createDbClient } from '@chathouse/database'
import { Redis } from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
export const redisOptions = {
  maxRetriesPerRequest: null as null,
  enableReadyCheck: false,
}

export const redis = new Redis(redisUrl, redisOptions)

export const db = createDbClient(process.env.DATABASE_URL!)
