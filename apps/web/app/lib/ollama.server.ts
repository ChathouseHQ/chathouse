import { OLLAMA_DEFAULT_BASE_URL } from './providers'

const OLLAMA_MODEL_FETCH_TIMEOUT_MS = 5_000

function getOllamaBaseUrlCandidates(input: string): string[] {
  const value = input.trim() || OLLAMA_DEFAULT_BASE_URL
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error('Enter a valid Ollama or OpenWebUI URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Ollama URLs must start with http:// or https://')
  }

  url.search = ''
  url.hash = ''
  url.pathname = url.pathname.replace(/\/+$/, '')

  const path = url.pathname
  if (!path || path === '/') {
    return [`${url.origin}/v1`, `${url.origin}/api`]
  }

  if (path.endsWith('/v1') || path.endsWith('/api')) {
    return [url.toString()]
  }

  throw new Error('Ollama base URL must be an origin, or end with /v1 or /api')
}

function parseOpenAICompatibleModelIds(value: unknown): string[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { data?: unknown }).data)) {
    return []
  }

  const ids = new Set<string>()
  for (const item of (value as { data: unknown[] }).data) {
    if (!item || typeof item !== 'object') continue
    const id = (item as { id?: unknown }).id
    if (typeof id === 'string' && id.trim()) ids.add(id.trim())
  }

  return [...ids]
}

export async function validateOpenAICompatibleModelEndpoint(
  baseUrlInput: string,
  apiKey?: string,
): Promise<{ baseUrl: string; modelIds: string[] }> {
  const candidates = getOllamaBaseUrlCandidates(baseUrlInput)
  const errors: string[] = []

  for (const baseUrl of candidates) {
    try {
      const trimmedApiKey = apiKey?.trim()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), OLLAMA_MODEL_FETCH_TIMEOUT_MS)
      const response = await fetch(`${baseUrl}/models`, {
        signal: controller.signal,
        ...(trimmedApiKey ? { headers: { Authorization: `Bearer ${trimmedApiKey}` } } : {}),
      }).finally(() => clearTimeout(timeout))

      if (!response.ok) {
        errors.push(`${baseUrl} returned ${response.status}`)
        continue
      }

      return { baseUrl, modelIds: parseOpenAICompatibleModelIds(await response.json()) }
    } catch (reason) {
      const message =
        reason instanceof Error && reason.name === 'AbortError'
          ? 'request timed out'
          : reason instanceof Error
            ? reason.message
            : 'request failed'
      errors.push(`${baseUrl}: ${message}`)
    }
  }

  throw new Error(errors[0] || 'Could not reach the Ollama model endpoint')
}
