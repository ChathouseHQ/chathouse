export type Provider = 'openai' | 'anthropic' | 'google'

export const REASONING_LEVELS = ['minimal', 'low', 'medium', 'high', 'xhigh'] as const

export type ReasoningLevel = (typeof REASONING_LEVELS)[number]

export function isReasoningLevel(value: unknown): value is ReasoningLevel {
  return typeof value === 'string' && REASONING_LEVELS.includes(value as ReasoningLevel)
}

export interface ChatJobData {
  messageId: string
  chatId: string
  userId: string
  content: string
  model: string
  systemPrompt?: string
  fileIds?: string[]
  reasoningEffort?: ReasoningLevel
}

export interface TitleJobData {
  chatId: string
  userId: string
  firstMessage: string
  strategy: 'ai' | 'first_chars'
}

export interface ModelRefreshJobData {
  userId: string
  provider?: Provider
}
