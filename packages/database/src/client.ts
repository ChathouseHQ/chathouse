import { PrismaMariaDb } from '@prisma/adapter-mariadb'

import { PrismaClient } from '../generated/prisma/client.js'

export function parseConnectionString(connectionString: string) {
  const url = new URL(connectionString)
  return {
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  }
}

export function createDbClient(
  connectionString: string,
  log: Array<'error' | 'warn' | 'info' | 'query'> = ['error', 'warn'],
) {
  const adapter = new PrismaMariaDb(parseConnectionString(connectionString))
  return new PrismaClient({ adapter, log })
}
