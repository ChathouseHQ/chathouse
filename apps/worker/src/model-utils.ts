import type { Provider } from '@chathouse/database'

const WORKER_PROVIDERS = ['openai', 'anthropic', 'google', 'ollama'] as const satisfies Provider[]

export function isOpenAIModelId(modelId: string): boolean {
  const id = modelId.toLowerCase()
  if (!(id.startsWith('gpt-') || /^o\d/.test(id) || id.startsWith('chatgpt'))) {
    return false
  }

  return !['audio', 'image', 'realtime', 'transcribe', 'tts', 'whisper'].some((part) =>
    id.includes(part),
  )
}

export function isGoogleChatModelId(modelId: string): boolean {
  const id = modelId.toLowerCase()
  if (!id.startsWith('gemini')) return false

  return !['audio', 'embedding', 'image', 'live', 'native-audio', 'robotics', 'tts'].some((part) =>
    id.includes(part),
  )
}

function isProvider(value: unknown): value is Provider {
  return typeof value === 'string' && WORKER_PROVIDERS.includes(value as Provider)
}

function inferProviderForModel(modelId: string): Provider | undefined {
  const id = modelId.toLowerCase()

  if (isOpenAIModelId(id)) {
    return 'openai'
  }

  if (id.startsWith('claude')) {
    return 'anthropic'
  }

  if (id.startsWith('gemini')) {
    return 'google'
  }

  return undefined
}

export function resolveProviderForModelId(
  modelId: string,
  cachedProvider?: string | null,
): Provider | undefined {
  if (isProvider(cachedProvider)) return cachedProvider
  return inferProviderForModel(modelId)
}

export function formatModelName(modelId: string): string {
  return modelId
    .replace(/[/_:-]+/g, ' ')
    .replace(/\b(llama|gemma|qwen|mistral|mixtral|deepseek|phi)(\d)/gi, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bGpt\b/g, 'GPT')
    .replace(/\bOss\b/g, 'OSS')
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bR(\d)\b/g, 'R$1')
    .replace(/\b(\d+)b\b/gi, '$1B')
    .replace(/Gemini/g, 'Gemini')
    .replace(/Claude/g, 'Claude')
    .replace(/ Latest$/i, '')
    .replace(/(\d{8})$/, '')
    .trim()
}
