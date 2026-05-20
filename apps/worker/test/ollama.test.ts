import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { formatModelName, resolveProviderForModelId } from '../src/model-utils.ts'
import {
  fetchOpenAICompatibleModelIds,
  getOllamaBaseUrlCandidates,
  parseOpenAICompatibleModelIds,
} from '../src/ollama.ts'

describe('ollama connection helpers', () => {
  it('normalizes origin URLs to direct Ollama and OpenWebUI candidates', () => {
    assert.deepEqual(getOllamaBaseUrlCandidates('http://localhost:11434'), [
      'http://localhost:11434/v1',
      'http://localhost:11434/api',
    ])
  })

  it('accepts explicit OpenAI-compatible base paths', () => {
    assert.deepEqual(getOllamaBaseUrlCandidates('http://localhost:3000/api/'), [
      'http://localhost:3000/api',
    ])
    assert.deepEqual(getOllamaBaseUrlCandidates('https://models.example.com/openai/v1'), [
      'https://models.example.com/openai/v1',
    ])
  })

  it('rejects invalid or unsupported URLs', () => {
    assert.throws(() => getOllamaBaseUrlCandidates('not a url'), /valid/)
    assert.throws(() => getOllamaBaseUrlCandidates('ftp://localhost:11434'), /http/)
    assert.throws(() => getOllamaBaseUrlCandidates('http://localhost:11434/ollama'), /end with/)
  })

  it('parses OpenAI-compatible model lists', () => {
    assert.deepEqual(
      parseOpenAICompatibleModelIds({
        data: [{ id: 'llama3.2' }, { id: 'gpt-oss:20b' }, { id: 'llama3.2' }, { id: '' }],
      }),
      ['llama3.2', 'gpt-oss:20b'],
    )
  })

  it('fetches models with optional bearer auth', async () => {
    const requests: Array<{ url: string; authorization?: string }> = []
    const modelIds = await fetchOpenAICompatibleModelIds(
      'http://localhost:11434/v1/',
      'test-token',
      async (input, init) => {
        const headers = init?.headers as Record<string, string> | undefined
        requests.push({
          url: String(input),
          authorization: headers?.Authorization,
        })
        return Response.json({ data: [{ id: 'llama3.2' }] })
      },
    )

    assert.deepEqual(modelIds, ['llama3.2'])
    assert.deepEqual(requests, [
      { url: 'http://localhost:11434/v1/models', authorization: 'Bearer test-token' },
    ])
  })
})

describe('ollama model metadata helpers', () => {
  it('formats common local model ids for display', () => {
    assert.equal(formatModelName('llama3.2'), 'Llama 3.2')
    assert.equal(formatModelName('gpt-oss:20b'), 'GPT OSS 20B')
    assert.equal(formatModelName('deepseek-r1:8b'), 'Deepseek R1 8B')
  })

  it('uses cached provider before model-id prefix heuristics', () => {
    assert.equal(resolveProviderForModelId('totally-custom-local-model', 'ollama'), 'ollama')
    assert.equal(resolveProviderForModelId('gpt-5.4'), 'openai')
    assert.equal(resolveProviderForModelId('totally-custom-local-model'), undefined)
  })
})
