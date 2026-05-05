import type { Provider, ModelFeature, PriceTier, ReasoningLevel } from '@chathouse/database'

export type { Provider, ModelFeature, PriceTier, ReasoningLevel }

export interface ModelInfo {
  id: string
  name: string
  versionLabel?: string
  provider: Provider
  contextWindow?: number
  description?: string
  knowledgeCutoff?: string
  priceTier?: PriceTier
  features?: ModelFeature[]
  reasoningLevels?: ReasoningLevel[]
}
