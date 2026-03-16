export type Provider = 'openai' | 'anthropic' | 'google'

export interface ChatJobData {
  messageId: string
  chatId: string
  userId: string
  content: string
  model: string
  systemPrompt?: string
  fileIds?: string[]
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
