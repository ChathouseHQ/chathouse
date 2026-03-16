import type { Provider } from '@chathouse/database'

export type { Provider }

export interface ModelInfo {
  id: string
  name: string
  provider: Provider
  contextWindow?: number
  description?: string
}
