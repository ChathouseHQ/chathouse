import Redis from 'ioredis'

declare global {
  var __redis: Redis | undefined
}

function createRedisClient() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379'
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
}

export const redis = globalThis.__redis ?? createRedisClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__redis = redis
}
