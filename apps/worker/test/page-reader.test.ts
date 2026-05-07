import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { extractReadableText, findInPage, openUrl } from '../src/tools/page-reader.ts'

describe('page reader tools', () => {
  it('extracts readable text from basic HTML', () => {
    const text = extractReadableText(`
      <html>
        <head><title>Ignored here</title><style>.x{}</style></head>
        <body><h1>Hello &amp; welcome</h1><script>bad()</script><p>Useful text.</p></body>
      </html>
    `)

    assert.equal(text, 'Ignored here Hello & welcome Useful text.')
  })

  it('blocks local URLs before fetching', async () => {
    let calls = 0
    const result = await openUrl(
      {
        url: 'http://127.0.0.1/admin',
      },
      {
        fetchFn: async () => {
          calls += 1
          return new Response()
        },
      },
    )

    assert.equal(result.text, undefined)
    assert.equal(result.error?.code, 'network_error')
    assert.match(result.error?.message ?? '', /blocked/i)
    assert.equal(calls, 0)
  })

  it('finds literal text in fetched page content', async () => {
    const signals = new Set<AbortSignal>()
    const result = await findInPage(
      {
        url: 'https://example.com/page',
        pattern: 'needle',
      },
      {
        resolveHostname: async () => ['93.184.216.34'],
        fetchFn: async (url, init) => {
          assert.equal(url.toString(), 'https://93.184.216.34/page')
          assert.ok(init)
          assert.equal((init.headers as Record<string, string>).Host, 'example.com')
          if (init.signal) signals.add(init.signal)
          return new Response(
            '<html><body>First paragraph. The needle is here. Tail text.</body></html>',
            {
              headers: { 'content-type': 'text/html' },
            },
          )
        },
      },
    )

    assert.equal(result.error, undefined)
    assert.equal(signals.size, 1)
    assert.equal(result.matches.length, 1)
    assert.match(result.matches[0].excerpt, /needle is here/)
  })

  it('reuses one timeout signal across redirects', async () => {
    const signals = new Set<AbortSignal>()
    let calls = 0
    const result = await openUrl(
      {
        url: 'https://example.com/start',
      },
      {
        resolveHostname: async () => ['93.184.216.34'],
        fetchFn: async (_url, init) => {
          if (init?.signal) signals.add(init.signal)
          calls += 1
          if (calls === 1) {
            return new Response(null, {
              status: 302,
              headers: { location: 'https://example.com/end' },
            })
          }

          return new Response('<html><body>Done.</body></html>', {
            headers: { 'content-type': 'text/html' },
          })
        },
      },
    )

    assert.equal(result.error, undefined)
    assert.equal(result.text, 'Done.')
    assert.equal(signals.size, 1)
    assert.equal(calls, 2)
  })
})
