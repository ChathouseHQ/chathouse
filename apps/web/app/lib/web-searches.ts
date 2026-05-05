export interface WebSearchSource {
  title: string
  url: string
  hostname: string
  age?: string
  snippets: string[]
}

export interface WebSearchError {
  code: string
  message: string
  status?: number
}

export interface WebSearchActivity {
  id: string
  query: string
  status: 'searching' | 'complete' | 'error'
  sources: WebSearchSource[]
  error?: WebSearchError
  startedAt: string
  completedAt?: string
}

export function parseWebSearches(value: unknown): WebSearchActivity[] {
  if (!value) return []

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (!Array.isArray(parsed)) return []

    return parsed.filter(isWebSearchActivity)
  } catch {
    return []
  }
}

function isWebSearchActivity(value: unknown): value is WebSearchActivity {
  if (!value || typeof value !== 'object') return false

  const item = value as Partial<WebSearchActivity>
  return (
    typeof item.id === 'string' &&
    typeof item.query === 'string' &&
    (item.status === 'searching' || item.status === 'complete' || item.status === 'error') &&
    Array.isArray(item.sources) &&
    typeof item.startedAt === 'string'
  )
}
