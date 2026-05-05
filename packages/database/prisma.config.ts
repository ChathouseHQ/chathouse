import { defineConfig } from '@prisma/config'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

function resolveShadowDatabaseUrl(databaseUrl?: string) {
  if (process.env.SHADOW_DATABASE_URL) {
    return process.env.SHADOW_DATABASE_URL
  }

  if (!databaseUrl) {
    return undefined
  }

  const url = new URL(databaseUrl)
  const databaseName = url.pathname.replace(/^\/+/, '')

  if (!databaseName) {
    return undefined
  }

  const localComposePort = process.env.MARIADB_PORT || '3307'
  const localComposeHosts = new Set(['localhost', '127.0.0.1', '[::1]'])

  if (
    !process.env.MARIADB_SHADOW_DATABASE &&
    (!localComposeHosts.has(url.hostname) || url.port !== localComposePort)
  ) {
    return undefined
  }

  url.pathname = `/${process.env.MARIADB_SHADOW_DATABASE || `${databaseName}_shadow`}`
  return url.toString()
}

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
    shadowDatabaseUrl: resolveShadowDatabaseUrl(process.env.DATABASE_URL),
  },
})
