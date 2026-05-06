import { jsonSchema, tool } from 'ai'
import { lookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'

interface OpenUrlInput {
  url: string
  contextSize?: 'small' | 'standard' | 'large'
}

interface FindInPageInput {
  url: string
  pattern: string
  maxMatches?: number
}

interface PageReadOutput {
  url: string
  finalUrl?: string
  title?: string
  text?: string
  contentType?: string
  error?: {
    code: string
    message: string
    status?: number
  }
}

interface FindInPageOutput {
  url: string
  finalUrl?: string
  pattern: string
  matches: Array<{
    index: number
    excerpt: string
  }>
  error?: {
    code: string
    message: string
    status?: number
  }
}

interface FetchPageOptions {
  fetchFn?: typeof fetch
  resolveHostname?: (hostname: string) => Promise<string[]>
  abortSignal?: AbortSignal
}

const PAGE_TIMEOUT_MS = 30_000
const MAX_REDIRECTS = 5
const MAX_RESPONSE_BYTES = 1_500_000
const FIND_CONTEXT_CHARS = 500

const CONTEXT_CHARS: Record<NonNullable<OpenUrlInput['contextSize']>, number> = {
  small: 6_000,
  standard: 14_000,
  large: 30_000,
}

const openUrlInputSchema = jsonSchema<OpenUrlInput>({
  type: 'object',
  properties: {
    url: {
      type: 'string',
      minLength: 1,
      maxLength: 2048,
      description: 'Public HTTP or HTTPS URL to open and extract readable page text from.',
    },
    contextSize: {
      type: 'string',
      enum: ['small', 'standard', 'large'],
      description:
        'How much extracted text to return. Use small for quick checks, standard by default, and large for deep reading.',
    },
  },
  required: ['url'],
  additionalProperties: false,
})

const findInPageInputSchema = jsonSchema<FindInPageInput>({
  type: 'object',
  properties: {
    url: {
      type: 'string',
      minLength: 1,
      maxLength: 2048,
      description: 'Public HTTP or HTTPS URL to search within.',
    },
    pattern: {
      type: 'string',
      minLength: 1,
      maxLength: 300,
      description:
        'Literal text pattern to find in the extracted page text. Not a regular expression.',
    },
    maxMatches: {
      type: 'number',
      minimum: 1,
      maximum: 10,
      description: 'Maximum number of matches to return. Defaults to 5.',
    },
  },
  required: ['url', 'pattern'],
  additionalProperties: false,
})

export async function openUrl(
  input: OpenUrlInput,
  options: FetchPageOptions = {},
): Promise<PageReadOutput> {
  const page = await fetchReadablePage(input.url, options)
  if (page.error) return page

  const maxChars = CONTEXT_CHARS[input.contextSize ?? 'standard']
  return {
    ...page,
    text: page.text?.slice(0, maxChars),
  }
}

export async function findInPage(
  input: FindInPageInput,
  options: FetchPageOptions = {},
): Promise<FindInPageOutput> {
  const page = await fetchReadablePage(input.url, options)
  if (page.error || !page.text) {
    return {
      url: input.url,
      finalUrl: page.finalUrl,
      pattern: input.pattern,
      matches: [],
      error: page.error,
    }
  }

  const pattern = normalizeWhitespace(input.pattern)
  if (!pattern) {
    return {
      url: input.url,
      finalUrl: page.finalUrl,
      pattern: input.pattern,
      matches: [],
      error: { code: 'invalid_pattern', message: 'Find pattern cannot be empty.' },
    }
  }

  const text = page.text
  const lowerText = text.toLowerCase()
  const lowerPattern = pattern.toLowerCase()
  const maxMatches = Math.min(Math.max(Math.floor(input.maxMatches ?? 5), 1), 10)
  const matches: FindInPageOutput['matches'] = []
  let searchFrom = 0

  while (matches.length < maxMatches) {
    const index = lowerText.indexOf(lowerPattern, searchFrom)
    if (index === -1) break

    const start = Math.max(0, index - FIND_CONTEXT_CHARS)
    const end = Math.min(text.length, index + pattern.length + FIND_CONTEXT_CHARS)
    matches.push({
      index,
      excerpt: text.slice(start, end).trim(),
    })
    searchFrom = index + pattern.length
  }

  return {
    url: input.url,
    finalUrl: page.finalUrl,
    pattern,
    matches,
  }
}

export function buildPageReaderTools() {
  return {
    open_url: tool({
      description:
        'Open a specific public web URL and extract readable text. Use after web_search when you need details from a source page or when the user gives a URL.',
      inputSchema: openUrlInputSchema,
      execute: async (input, options) => openUrl(input, { abortSignal: options.abortSignal }),
    }),
    find_in_page: tool({
      description:
        'Find literal text within a specific public web page and return surrounding excerpts. Use after opening/searching a page when looking for a named section, quote, term, or phrase.',
      inputSchema: findInPageInputSchema,
      execute: async (input, options) => findInPage(input, { abortSignal: options.abortSignal }),
    }),
  }
}

async function fetchReadablePage(
  rawUrl: string,
  options: FetchPageOptions,
): Promise<PageReadOutput> {
  let currentUrl: URL
  try {
    currentUrl = normalizePublicUrl(rawUrl)
  } catch (reason) {
    return {
      url: rawUrl,
      error: {
        code: 'invalid_url',
        message: reason instanceof Error ? reason.message : 'Invalid URL.',
      },
    }
  }

  const fetchFn = options.fetchFn
  const signal = createAbortSignal(options.abortSignal)

  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const addresses = await assertPublicHostname(currentUrl.hostname, options.resolveHostname)
      const resolvedUrl = createResolvedUrl(currentUrl, addresses[0])
      const headers = createRequestHeaders(currentUrl)

      const response = fetchFn
        ? await fetchFn(resolvedUrl, { redirect: 'manual', headers, signal })
        : await fetchResolvedUrl(currentUrl, addresses[0], headers, signal)

      if (isRedirect(response.status)) {
        const location = response.headers.get('location')
        if (!location) {
          return errorOutput(rawUrl, currentUrl.href, 'redirect_without_location', response.status)
        }
        currentUrl = normalizePublicUrl(new URL(location, currentUrl).href)
        continue
      }

      if (!response.ok) {
        return errorOutput(rawUrl, currentUrl.href, 'request_failed', response.status)
      }

      const contentType = response.headers.get('content-type') ?? ''
      if (!isReadableContentType(contentType)) {
        return {
          url: rawUrl,
          finalUrl: currentUrl.href,
          contentType,
          error: {
            code: 'unsupported_content_type',
            message: `Unsupported content type: ${contentType || 'unknown'}.`,
          },
        }
      }

      const html = await readLimitedText(response)
      const title = extractTitle(html)
      const text = extractReadableText(html)

      return {
        url: rawUrl,
        finalUrl: currentUrl.href,
        title,
        text,
        contentType,
      }
    }

    return {
      url: rawUrl,
      finalUrl: currentUrl.href,
      error: {
        code: 'too_many_redirects',
        message: `Stopped after ${MAX_REDIRECTS} redirects.`,
      },
    }
  } catch (reason) {
    return {
      url: rawUrl,
      finalUrl: currentUrl.href,
      error: {
        code: isAbortError(reason) ? 'timeout' : 'network_error',
        message:
          reason instanceof Error ? `Could not open URL: ${reason.message}` : 'Could not open URL.',
      },
    }
  }
}

function normalizePublicUrl(rawUrl: string): URL {
  const url = new URL(rawUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS URLs are supported.')
  }
  if (url.username || url.password) {
    throw new Error('URLs with embedded credentials are not supported.')
  }
  if (!url.hostname) throw new Error('URL hostname is required.')
  return url
}

async function assertPublicHostname(
  hostname: string,
  resolveHostname?: (hostname: string) => Promise<string[]>,
): Promise<string[]> {
  const normalized = stripIpv6Brackets(hostname.toLowerCase())
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local')
  ) {
    throw new Error('Local hostnames are blocked.')
  }

  if (isBlockedIp(normalized)) throw new Error('Private or local IP addresses are blocked.')
  if (isIP(normalized)) return [normalized]

  const addresses =
    resolveHostname ??
    (async (name: string) => {
      const records = await lookup(name, { all: true, verbatim: true })
      return records.map((record) => record.address)
    })

  const resolvedAddresses = (await addresses(normalized)).map(stripIpv6Brackets)
  if (resolvedAddresses.length === 0) throw new Error('Hostname did not resolve.')

  for (const address of resolvedAddresses) {
    if (isBlockedIp(address)) {
      throw new Error('Hostname resolves to a private or local IP address.')
    }
  }

  return resolvedAddresses
}

function createRequestHeaders(url: URL): Record<string, string> {
  return {
    Accept: 'text/html, text/plain, application/xhtml+xml;q=0.9, */*;q=0.1',
    Host: url.host,
    'User-Agent': 'ChathouseBot/1.0 (+https://github.com/chathouse)',
  }
}

function createResolvedUrl(url: URL, address: string): URL {
  const resolvedUrl = new URL(url)
  resolvedUrl.hostname = isIP(address) === 6 ? `[${address}]` : address
  return resolvedUrl
}

function fetchResolvedUrl(
  url: URL,
  address: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<Response> {
  const isHttps = url.protocol === 'https:'
  const request = isHttps ? https.request : http.request
  const port = url.port ? Number(url.port) : isHttps ? 443 : 80

  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: address,
        port,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers,
        servername: url.hostname,
        signal,
      },
      (res) => {
        const responseHeaders = new Headers()
        for (const [name, value] of Object.entries(res.headers)) {
          if (Array.isArray(value)) {
            for (const item of value) responseHeaders.append(name, item)
          } else if (value !== undefined) {
            responseHeaders.set(name, String(value))
          }
        }

        const status = res.statusCode ?? 500
        const body =
          status === 204 || status === 205 || status === 304
            ? null
            : (res as ConstructorParameters<typeof Response>[0])

        resolve(
          new Response(body, {
            status,
            statusText: res.statusMessage,
            headers: responseHeaders,
          }),
        )
      },
    )

    req.on('error', reject)
    req.end()
  })
}

function isBlockedIp(address: string): boolean {
  const normalized = stripIpv6Brackets(address.toLowerCase())
  if (normalized.startsWith('::ffff:')) {
    return isBlockedIpv4(normalized.slice('::ffff:'.length))
  }

  const version = isIP(normalized)
  if (version === 4) return isBlockedIpv4(normalized)
  if (version === 6) return isBlockedIpv6(address)
  return false
}

function isBlockedIpv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true
  const [a, b] = parts

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19))
  )
}

function isBlockedIpv6(address: string): boolean {
  const normalized = stripIpv6Brackets(address.toLowerCase())
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  )
}

function stripIpv6Brackets(value: string): string {
  return value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400
}

function isReadableContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase()
  return (
    !normalized ||
    normalized.includes('text/html') ||
    normalized.includes('text/plain') ||
    normalized.includes('application/xhtml')
  )
}

async function readLimitedText(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return response.text()

  const chunks: Uint8Array[] = []
  let total = 0

  while (total < MAX_RESPONSE_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.byteLength
  }

  await reader.cancel().catch(() => {})
  const buffer = Buffer.concat(chunks, Math.min(total, MAX_RESPONSE_BYTES))
  return new TextDecoder().decode(buffer)
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!match) return undefined
  return decodeHtml(normalizeWhitespace(match[1])).slice(0, 300)
}

export function extractReadableText(html: string): string {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|p|div|section|article|header|footer|li|tr|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  return decodeHtml(normalizeWhitespace(withoutNoise))
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function decodeHtml(text: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  }

  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match)
}

function errorOutput(url: string, finalUrl: string, code: string, status?: number): PageReadOutput {
  return {
    url,
    finalUrl,
    error: {
      code,
      status,
      message: status ? `URL request failed with HTTP ${status}.` : 'URL request failed.',
    },
  }
}

function createAbortSignal(parent?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(PAGE_TIMEOUT_MS)
  if (!parent) return timeout
  return AbortSignal.any([parent, timeout])
}

function isAbortError(reason: unknown): boolean {
  return reason instanceof Error && (reason.name === 'AbortError' || reason.name === 'TimeoutError')
}
