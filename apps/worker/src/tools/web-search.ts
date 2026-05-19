import { jsonSchema, tool } from 'ai'

type WebSearchFreshness = 'day' | 'week' | 'month' | 'year'
type WebSearchContextSize = 'small' | 'standard' | 'large'

interface WebSearchInput {
  query: string
  freshness?: WebSearchFreshness
  contextSize?: WebSearchContextSize
}

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

interface WebSearchOutput {
  query: string
  sources: WebSearchSource[]
  error?: WebSearchError
}

export interface WebSearchToolEvent {
  id: string
  status: 'searching' | 'complete' | 'error'
  query: string
  sources: WebSearchSource[]
  error?: WebSearchError
}

interface BraveLlmContextResponse {
  grounding?: {
    generic?: Array<{
      url?: unknown
      title?: unknown
      snippets?: unknown
    }>
  }
  sources?: Record<
    string,
    {
      title?: unknown
      hostname?: unknown
      age?: unknown
    }
  >
}

interface BraveSearchRequestOptions {
  apiKey: string
  fetchFn?: typeof fetch
  abortSignal?: AbortSignal
}

const BRAVE_LLM_CONTEXT_URL = 'https://api.search.brave.com/res/v1/llm/context'
const BRAVE_SEARCH_TIMEOUT_MS = 30_000
const MAX_WEB_SEARCH_CALLS = 3
const MAX_QUERY_CHARS = 400
const MAX_QUERY_WORDS = 50
const MAX_SNIPPET_CHARS = 1_200
const MAX_SNIPPETS_PER_SOURCE = 6
const MAX_SOURCES = 10

const FRESHNESS_PARAMS: Record<WebSearchFreshness, string> = {
  day: 'pd',
  week: 'pw',
  month: 'pm',
  year: 'py',
}

const CONTEXT_SIZE_PARAMS: Record<
  WebSearchContextSize,
  {
    count: number
    maximum_number_of_urls: number
    maximum_number_of_tokens: number
    maximum_number_of_snippets: number
    maximum_number_of_tokens_per_url: number
    maximum_number_of_snippets_per_url: number
  }
> = {
  small: {
    count: 5,
    maximum_number_of_urls: 5,
    maximum_number_of_tokens: 2048,
    maximum_number_of_snippets: 12,
    maximum_number_of_tokens_per_url: 1024,
    maximum_number_of_snippets_per_url: 3,
  },
  standard: {
    count: 20,
    maximum_number_of_urls: 10,
    maximum_number_of_tokens: 8192,
    maximum_number_of_snippets: 40,
    maximum_number_of_tokens_per_url: 2048,
    maximum_number_of_snippets_per_url: 5,
  },
  large: {
    count: 50,
    maximum_number_of_urls: 20,
    maximum_number_of_tokens: 16_384,
    maximum_number_of_snippets: 80,
    maximum_number_of_tokens_per_url: 4096,
    maximum_number_of_snippets_per_url: 8,
  },
}

const webSearchInputSchema = jsonSchema<WebSearchInput>({
  type: 'object',
  properties: {
    query: {
      type: 'string',
      minLength: 1,
      maxLength: MAX_QUERY_CHARS,
      description:
        'A concise web search query. Keep it under 50 words and include the key facts needed to ground the answer.',
    },
    freshness: {
      type: 'string',
      enum: ['day', 'week', 'month', 'year'],
      description:
        'Optional recency filter. Use day/week/month/year only when the user needs current or recent information.',
    },
    contextSize: {
      type: 'string',
      enum: ['small', 'standard', 'large'],
      description:
        'How much web context to retrieve. Use small for quick facts, standard by default, and large for deeper research.',
    },
  },
  required: ['query'],
  additionalProperties: false,
})

export function buildBraveLlmContextUrl(input: WebSearchInput): URL {
  const query = normalizeWebSearchQuery(input.query)
  const contextSize = input.contextSize ?? 'standard'
  const params = CONTEXT_SIZE_PARAMS[contextSize]
  const url = new URL(BRAVE_LLM_CONTEXT_URL)

  url.searchParams.set('q', query)
  url.searchParams.set('context_threshold_mode', 'balanced')

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }

  if (input.freshness) {
    url.searchParams.set('freshness', FRESHNESS_PARAMS[input.freshness])
  }

  return url
}

export function normalizeBraveLlmContextResponse(
  query: string,
  data: BraveLlmContextResponse,
): WebSearchOutput {
  const sourcesByUrl = new Map<string, WebSearchSource>()

  for (const item of data.grounding?.generic ?? []) {
    if (typeof item.url !== 'string' || !item.url) continue

    const metadata = data.sources?.[item.url]
    const hostname = readString(metadata?.hostname) ?? getHostname(item.url)
    const title = readString(item.title) ?? readString(metadata?.title) ?? item.url
    const age = normalizeAge(metadata?.age)
    const snippets = normalizeSnippets(item.snippets)

    if (snippets.length === 0) continue

    const existing = sourcesByUrl.get(item.url)
    if (existing) {
      existing.snippets = mergeSnippets(existing.snippets, snippets)
      continue
    }

    sourcesByUrl.set(item.url, {
      title,
      url: item.url,
      hostname,
      ...(age ? { age } : {}),
      snippets: snippets.slice(0, MAX_SNIPPETS_PER_SOURCE),
    })
  }

  return {
    query,
    sources: [...sourcesByUrl.values()].slice(0, MAX_SOURCES),
  }
}

export async function searchBraveLlmContext(
  input: WebSearchInput,
  options: BraveSearchRequestOptions,
): Promise<WebSearchOutput> {
  const query = normalizeWebSearchQuery(input.query)

  if (!query) {
    return {
      query: '',
      sources: [],
      error: {
        code: 'invalid_query',
        message: 'Search query cannot be empty.',
      },
    }
  }

  try {
    const response = await (options.fetchFn ?? fetch)(
      buildBraveLlmContextUrl({ ...input, query }),
      {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': options.apiKey,
        },
        signal: createAbortSignal(options.abortSignal),
      },
    )

    if (!response.ok) {
      return {
        query,
        sources: [],
        error: {
          code: 'brave_request_failed',
          status: response.status,
          message: `Brave Search request failed with HTTP ${response.status}.`,
        },
      }
    }

    const data = (await response.json()) as BraveLlmContextResponse
    const output = normalizeBraveLlmContextResponse(query, data)

    if (output.sources.length === 0) {
      return {
        ...output,
        error: {
          code: 'no_results',
          message: 'Brave Search returned no relevant web context for this query.',
        },
      }
    }

    return output
  } catch (reason) {
    return {
      query,
      sources: [],
      error: {
        code: isAbortError(reason) ? 'timeout' : 'network_error',
        message:
          reason instanceof Error
            ? `Brave Search request failed: ${reason.message}`
            : 'Brave Search request failed for an unknown reason.',
      },
    }
  }
}

export function createWebSearchTool({
  apiKey,
  fetchFn,
  maxCalls = MAX_WEB_SEARCH_CALLS,
  onEvent,
}: {
  apiKey: string
  fetchFn?: typeof fetch
  maxCalls?: number
  onEvent?: (event: WebSearchToolEvent) => Promise<void> | void
}) {
  let calls = 0

  return tool({
    description:
      'Search the public web for current, source-sensitive, or fast-changing information. Use this before answering questions that need up-to-date facts, recent events, prices, releases, schedules, laws, or precise source attribution.',
    inputSchema: webSearchInputSchema,
    execute: async (input, options): Promise<WebSearchOutput> => {
      const query = normalizeWebSearchQuery(input.query)

      if (calls >= maxCalls) {
        const output = {
          query,
          sources: [],
          error: {
            code: 'call_budget_exceeded',
            message: `The per-response web search budget of ${maxCalls} calls has been used.`,
          },
        }
        await onEvent?.({ id: options.toolCallId, status: 'error', ...output })
        return output
      }

      calls += 1
      await onEvent?.({ id: options.toolCallId, status: 'searching', query, sources: [] })

      const output = await searchBraveLlmContext(input, {
        apiKey,
        fetchFn,
        abortSignal: options.abortSignal,
      })

      await onEvent?.({
        id: options.toolCallId,
        status: output.error ? 'error' : 'complete',
        ...output,
      })

      return output
    },
  })
}

export function buildWebSearchTools({
  apiKey = process.env.BRAVE_SEARCH_API_KEY,
  onEvent,
}: {
  apiKey?: string
  onEvent?: (event: WebSearchToolEvent) => Promise<void> | void
} = {}) {
  const trimmedKey = apiKey?.trim()
  if (!trimmedKey) return undefined

  return {
    web_search: createWebSearchTool({ apiKey: trimmedKey, onEvent }),
  }
}

function normalizeWebSearchQuery(query: string): string {
  return query
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, MAX_QUERY_WORDS)
    .join(' ')
    .slice(0, MAX_QUERY_CHARS)
    .trim()
}

function normalizeSnippets(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const snippets: string[] = []

  for (const item of value) {
    const snippet = stringifySnippet(item)
    if (!snippet) continue
    if (snippets.includes(snippet)) continue
    snippets.push(snippet)
  }

  return snippets.slice(0, MAX_SNIPPETS_PER_SOURCE)
}

function stringifySnippet(value: unknown): string | undefined {
  const raw = typeof value === 'string' ? value : JSON.stringify(value)
  if (!raw) return undefined

  const snippet = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_SNIPPET_CHARS).trim()
  return snippet || undefined
}

function mergeSnippets(existing: string[], incoming: string[]): string[] {
  return [...new Set([...existing, ...incoming])].slice(0, MAX_SNIPPETS_PER_SOURCE)
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeAge(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (!Array.isArray(value)) return undefined

  const parts = value.filter((item): item is string => typeof item === 'string' && !!item.trim())
  return parts.length > 0 ? parts.join(', ') : undefined
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

function createAbortSignal(parent?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(BRAVE_SEARCH_TIMEOUT_MS)
  if (!parent) return timeout
  return AbortSignal.any([parent, timeout])
}

function isAbortError(reason: unknown): boolean {
  return reason instanceof Error && (reason.name === 'AbortError' || reason.name === 'TimeoutError')
}
