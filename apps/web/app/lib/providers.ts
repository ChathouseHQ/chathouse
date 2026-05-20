import type { Provider } from './models'

export const ALL_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'ollama',
] as const satisfies readonly Provider[]

export const PROVIDER_NAMES: Record<Provider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  ollama: 'Ollama',
}

export const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1'

export const OLLAMA_PRESETS = [
  { label: 'Local', value: OLLAMA_DEFAULT_BASE_URL },
  { label: 'Docker host', value: 'http://host.docker.internal:11434/v1' },
  { label: 'OpenWebUI', value: 'http://localhost:3000/api' },
] as const

export function isProvider(value: unknown): value is Provider {
  return typeof value === 'string' && ALL_PROVIDERS.includes(value as Provider)
}
