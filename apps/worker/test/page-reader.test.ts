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
    const result = await openUrl({
      url: 'http://127.0.0.1/admin',
    })

    assert.equal(result.text, undefined)
    assert.equal(result.error?.code, 'network_error')
    assert.match(result.error?.message ?? '', /blocked/i)
  })

  it('finds literal text in fetched page content', async () => {
    const result = await findInPage(
      {
        url: 'https://example.com/page',
        pattern: 'needle',
      },
      {
        resolveHostname: async () => ['93.184.216.34'],
        fetchFn: async () =>
          new Response(
            '<html><body>First paragraph. The needle is here. Tail text.</body></html>',
            {
              headers: { 'content-type': 'text/html' },
            },
          ),
      },
    )

    assert.equal(result.error, undefined)
    assert.equal(result.matches.length, 1)
    assert.match(result.matches[0].excerpt, /needle is here/)
  })
})
