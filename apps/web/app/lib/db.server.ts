import { createDbClient, PrismaClient } from '@chathouse/database'

declare global {
  var __prisma: InstanceType<typeof PrismaClient> | undefined
}

function getDb() {
  const log =
    process.env.NODE_ENV === 'development' ? (['error', 'warn'] as const) : (['error'] as const)
  return createDbClient(process.env.DATABASE_URL!, [...log])
}

export const db = globalThis.__prisma ?? getDb()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = db
}
