import { createLogger } from '@chathouse/logger'

import { isMissingColumnError } from './db-errors.server'
import { db } from './db.server'
import { parseWebSearches, type WebSearchActivity } from './web-searches'

type WebSearchRow = {
  id: string
  webSearches: string | null
}

const logger = createLogger('web:web-searches')

export async function getMessageWebSearches(messageId: string): Promise<WebSearchActivity[]> {
  try {
    const rows = await db.$queryRaw<WebSearchRow[]>`
      SELECT id, webSearches
      FROM messages
      WHERE id = ${messageId}
      LIMIT 1
    `

    return parseWebSearches(rows[0]?.webSearches)
  } catch (err) {
    if (isMissingColumnError(err, 'webSearches')) return []
    logger.error('Failed to load message web searches:', err)
    throw err
  }
}

export async function attachWebSearchesToMessages<T extends { id: string }>(
  messages: T[],
): Promise<Array<T & { webSearches: WebSearchActivity[] }>> {
  if (messages.length === 0) return []

  const placeholders = messages.map(() => '?').join(', ')
  try {
    const rows = (await db.$queryRawUnsafe(
      `SELECT id, webSearches FROM messages WHERE id IN (${placeholders})`,
      ...messages.map((message) => message.id),
    )) as WebSearchRow[]
    const byMessageId = new Map(rows.map((row) => [row.id, parseWebSearches(row.webSearches)]))

    return messages.map((message) => ({
      ...message,
      webSearches: byMessageId.get(message.id) ?? [],
    }))
  } catch (err) {
    if (!isMissingColumnError(err, 'webSearches')) {
      logger.error('Failed to attach web searches to messages:', err)
      throw err
    }

    return messages.map((message) => ({ ...message, webSearches: [] }))
  }
}
