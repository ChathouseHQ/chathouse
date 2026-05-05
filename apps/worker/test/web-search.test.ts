import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildBraveLlmContextUrl,
  buildWebSearchTools,
  createWebSearchTool,
  normalizeBraveLlmContextResponse,
  searchBraveLlmContext,
} from '../src/tools/web-search.ts'

describe('Brave web search tool', () => {
  it('maps freshness and context size to Brave LLM Context parameters', () => {
    const url = buildBraveLlmContextUrl({
      query: 'latest TypeScript release notes',
      freshness: 'week',
      contextSize: 'large',
    })

    assert.equal(url.origin + url.pathname, 'https://api.search.brave.com/res/v1/llm/context')
    assert.equal(url.searchParams.get('q'), 'latest TypeScript release notes')
    assert.equal(url.searchParams.get('freshness'), 'pw')
    assert.equal(url.searchParams.get('count'), '50')
    assert.equal(url.searchParams.get('maximum_number_of_urls'), '20')
    assert.equal(url.searchParams.get('maximum_number_of_tokens'), '16384')
    assert.equal(url.searchParams.get('context_threshold_mode'), 'balanced')
  })

  it('normalizes Brave grounding data into compact sources', () => {
    const output = normalizeBraveLlmContextResponse('query', {
      grounding: {
        generic: [
          {
            url: 'https://example.com/article',
            title: ' Article title ',
            snippets: [
              ' First snippet\nwith whitespace. ',
              'First snippet with whitespace.',
              { table: ['structured', 'data'] },
            ],
          },
        ],
      },
      sources: {
        'https://example.com/article': {
          hostname: 'example.com',
          age: ['2026-05-01'],
        },
      },
    })

    assert.equal(output.error, undefined)
    assert.deepEqual(output.sources, [
      {
        title: 'Article title',
        url: 'https://example.com/article',
        hostname: 'example.com',
        age: '2026-05-01',
        snippets: ['First snippet with whitespace.', '{"table":["structured","data"]}'],
      },
    ])
  })

  it('does not expose tools when the API key is missing', () => {
    assert.equal(buildWebSearchTools(''), undefined)
    assert.equal(buildWebSearchTools('   '), undefined)
  })

  it('returns structured errors for Brave HTTP failures', async () => {
    const output = await searchBraveLlmContext(
      { query: 'news today' },
      {
        apiKey: 'test-key',
        fetchFn: async () =>
          new Response(JSON.stringify({ error: 'rate limited' }), {
            status: 429,
            headers: { 'content-type': 'application/json' },
          }),
      },
    )

    assert.deepEqual(output, {
      query: 'news today',
      sources: [],
      error: {
        code: 'brave_request_failed',
        status: 429,
        message: 'Brave Search request failed with HTTP 429.',
      },
    })
  })

  it('enforces a per-response tool call budget', async () => {
    const searchTool = createWebSearchTool({
      apiKey: 'test-key',
      maxCalls: 1,
      fetchFn: async () =>
        Response.json({
          grounding: {
            generic: [
              {
                url: 'https://example.com',
                title: 'Example',
                snippets: ['Useful grounding.'],
              },
            ],
          },
          sources: {
            'https://example.com': {
              hostname: 'example.com',
            },
          },
        }),
    })

    const execute = searchTool.execute
    assert.ok(execute)

    const first = await execute({ query: 'first query' }, { toolCallId: 'call-1', messages: [] })
    const second = await execute({ query: 'second query' }, { toolCallId: 'call-2', messages: [] })

    assert.equal(first.error, undefined)
    assert.equal(first.sources.length, 1)
    assert.equal(second.error?.code, 'call_budget_exceeded')
    assert.deepEqual(second.sources, [])
  })
})
