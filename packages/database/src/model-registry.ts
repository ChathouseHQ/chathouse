import type { Provider, ReasoningLevel } from './types.js'

export type ModelFeature = 'vision' | 'reasoning'

export type PriceTier = 'free' | '$' | '$$' | '$$$' | '$$$$'

export interface ModelMetadata {
  displayName: string
  description: string
  provider: Provider
  knowledgeCutoff?: string
  priceTier: PriceTier
  inputPricePerMillion?: number
  outputPricePerMillion?: number
  features: ModelFeature[]
  reasoningLevels?: ReasoningLevel[]
  contextWindow?: number
}

export interface ModelMetadataMatch {
  key: string
  metadata: ModelMetadata
  isExact: boolean
}

const OPENAI_REASONING: ReasoningLevel[] = ['low', 'medium', 'high']
const OPENAI_REASONING_WITH_MINIMAL: ReasoningLevel[] = ['minimal', ...OPENAI_REASONING]
const OPENAI_REASONING_WITH_XHIGH: ReasoningLevel[] = [...OPENAI_REASONING, 'xhigh']
const OPENAI_PRO_REASONING: ReasoningLevel[] = ['medium', 'high', 'xhigh']
const OPENAI_HIGH_ONLY: ReasoningLevel[] = ['high']
const STANDARD_REASONING: ReasoningLevel[] = ['low', 'medium', 'high']
const ANTHROPIC_OPUS_47_REASONING: ReasoningLevel[] = ['low', 'medium', 'high', 'xhigh']
const GEMINI_3_REASONING: ReasoningLevel[] = ['minimal', 'low', 'medium', 'high']

// Keyed by model ID. For versioned IDs (e.g. claude-3-5-sonnet-20241022),
// getModelMetadata() falls back to delimiter-aware prefix matching.
const MODEL_REGISTRY: Record<string, ModelMetadata> = {
  // ---------------------------------------------------------------------------
  // OpenAI - GPT-5.5 and GPT-5.4
  // ---------------------------------------------------------------------------
  'gpt-5.5': {
    displayName: 'GPT-5.5',
    description: 'Newest OpenAI frontier model for complex professional work',
    provider: 'openai',
    knowledgeCutoff: 'Dec 2025',
    priceTier: '$$$$',
    inputPricePerMillion: 5,
    outputPricePerMillion: 30,
    features: ['vision', 'reasoning'],
    reasoningLevels: OPENAI_REASONING_WITH_XHIGH,
    contextWindow: 1_050_000,
  },
  'gpt-5.5-pro': {
    displayName: 'GPT-5.5 Pro',
    description: 'Highest-compute GPT-5.5 for the hardest problems',
    provider: 'openai',
    knowledgeCutoff: 'Dec 2025',
    priceTier: '$$$$',
    inputPricePerMillion: 30,
    outputPricePerMillion: 180,
    features: ['vision', 'reasoning'],
    reasoningLevels: OPENAI_PRO_REASONING,
    contextWindow: 1_050_000,
  },
  'gpt-5.4': {
    displayName: 'GPT-5.4',
    description: 'Frontier GPT model for agentic and coding workflows',
    provider: 'openai',
    knowledgeCutoff: 'Aug 2025',
    priceTier: '$$$',
    inputPricePerMillion: 2.5,
    outputPricePerMillion: 15,
    features: ['vision', 'reasoning'],
    reasoningLevels: OPENAI_REASONING_WITH_XHIGH,
    contextWindow: 1_050_000,
  },
  'gpt-5.4-pro': {
    displayName: 'GPT-5.4 Pro',
    description: 'Higher-compute GPT-5.4 for more precise answers',
    provider: 'openai',
    knowledgeCutoff: 'Aug 2025',
    priceTier: '$$$$',
    inputPricePerMillion: 30,
    outputPricePerMillion: 180,
    features: ['vision', 'reasoning'],
    reasoningLevels: OPENAI_PRO_REASONING,
    contextWindow: 1_050_000,
  },
  'gpt-5.4-mini': {
    displayName: 'GPT-5.4 Mini',
    description: 'Lower-latency GPT-5.4 model for high-volume work',
    provider: 'openai',
    knowledgeCutoff: 'Aug 2025',
    priceTier: '$$',
    inputPricePerMillion: 0.75,
    outputPricePerMillion: 4.5,
    features: ['vision', 'reasoning'],
    reasoningLevels: OPENAI_REASONING_WITH_XHIGH,
    contextWindow: 400_000,
  },
  'gpt-5.4-nano': {
    displayName: 'GPT-5.4 Nano',
    description: 'Cheapest GPT-5.4-class model for simple high-volume tasks',
    provider: 'openai',
    knowledgeCutoff: 'Aug 2025',
    priceTier: '$',
    inputPricePerMillion: 0.2,
    outputPricePerMillion: 1.25,
    features: ['vision', 'reasoning'],
    reasoningLevels: OPENAI_REASONING,
    contextWindow: 400_000,
  },

  // ---------------------------------------------------------------------------
  // OpenAI - GPT-5 and GPT-4.x
  // ---------------------------------------------------------------------------
  'gpt-5.3-codex': {
    displayName: 'GPT-5.3-Codex',
    description: 'OpenAI coding model optimized for long agentic software tasks',
    provider: 'openai',
    knowledgeCutoff: 'Aug 2025',
    priceTier: '$$$',
    inputPricePerMillion: 1.75,
    outputPricePerMillion: 14,
    features: ['vision', 'reasoning'],
    reasoningLevels: OPENAI_REASONING_WITH_XHIGH,
    contextWindow: 400_000,
  },
  'gpt-5.2': {
    displayName: 'GPT-5.2',
    description: 'Previous OpenAI frontier model for professional work',
    provider: 'openai',
    knowledgeCutoff: 'Aug 2025',
    priceTier: '$$$',
    inputPricePerMillion: 1.75,
    outputPricePerMillion: 14,
    features: ['vision', 'reasoning'],
    reasoningLevels: OPENAI_REASONING_WITH_XHIGH,
    contextWindow: 400_000,
  },
  'gpt-5.2-pro': {
    displayName: 'GPT-5.2 Pro',
    description: 'Previous higher-compute GPT-5.2 model for difficult professional work',
    provider: 'openai',
    knowledgeCutoff: 'Aug 2025',
    priceTier: '$$$$',
    inputPricePerMillion: 21,
    outputPricePerMillion: 168,
    features: ['vision', 'reasoning'],
    reasoningLevels: OPENAI_PRO_REASONING,
    contextWindow: 400_000,
  },
  'gpt-5.1': {
    displayName: 'GPT-5.1',
    description: 'Previous GPT model for coding and agentic tasks',
    provider: 'openai',
    knowledgeCutoff: 'Sep 2024',
    priceTier: '$$$',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 10,
    features: ['vision', 'reasoning'],
    reasoningLevels: OPENAI_REASONING,
    contextWindow: 400_000,
  },
  'gpt-5-pro': {
    displayName: 'GPT-5 Pro',
    description: 'Higher-compute GPT-5 model for hard reasoning problems',
    provider: 'openai',
    knowledgeCutoff: 'Sep 2024',
    priceTier: '$$$$',
    inputPricePerMillion: 15,
    outputPricePerMillion: 120,
    features: ['vision', 'reasoning'],
    reasoningLevels: OPENAI_HIGH_ONLY,
    contextWindow: 400_000,
  },
  'gpt-5': {
    displayName: 'GPT-5',
    description: 'Previous GPT reasoning model for coding and agents',
    provider: 'openai',
    knowledgeCutoff: 'Sep 2024',
    priceTier: '$$$',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 10,
    features: ['vision', 'reasoning'],
    reasoningLevels: OPENAI_REASONING_WITH_MINIMAL,
    contextWindow: 400_000,
  },
  'gpt-5-mini': {
    displayName: 'GPT-5 Mini',
    description: 'Fast, cost-efficient GPT-5 model',
    provider: 'openai',
    knowledgeCutoff: 'May 2024',
    priceTier: '$',
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 2,
    features: ['vision', 'reasoning'],
    reasoningLevels: OPENAI_REASONING_WITH_MINIMAL,
    contextWindow: 400_000,
  },
  'gpt-5-nano': {
    displayName: 'GPT-5 Nano',
    description: 'Fastest and cheapest GPT-5 model',
    provider: 'openai',
    knowledgeCutoff: 'May 2024',
    priceTier: '$',
    inputPricePerMillion: 0.05,
    outputPricePerMillion: 0.4,
    features: ['vision', 'reasoning'],
    reasoningLevels: OPENAI_REASONING_WITH_MINIMAL,
    contextWindow: 400_000,
  },
  'gpt-4.1': {
    displayName: 'GPT-4.1',
    description: 'Strong non-reasoning GPT model with long context',
    provider: 'openai',
    knowledgeCutoff: 'Mar 2025',
    priceTier: '$$',
    inputPricePerMillion: 2,
    outputPricePerMillion: 8,
    features: ['vision'],
    contextWindow: 1_047_576,
  },
  'gpt-4.1-mini': {
    displayName: 'GPT-4.1 Mini',
    description: 'Fast and affordable long-context GPT-4.1 variant',
    provider: 'openai',
    knowledgeCutoff: 'Mar 2025',
    priceTier: '$',
    inputPricePerMillion: 0.4,
    outputPricePerMillion: 1.6,
    features: ['vision'],
    contextWindow: 1_047_576,
  },
  'gpt-4.1-nano': {
    displayName: 'GPT-4.1 Nano',
    description: 'Cheapest GPT-4.1 model for simple tasks',
    provider: 'openai',
    knowledgeCutoff: 'Mar 2025',
    priceTier: '$',
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0.4,
    features: ['vision'],
    contextWindow: 1_047_576,
  },
  'gpt-4o': {
    displayName: 'GPT-4o',
    description: 'Previous-generation multimodal GPT model',
    provider: 'openai',
    knowledgeCutoff: 'Oct 2023',
    priceTier: '$$',
    inputPricePerMillion: 2.5,
    outputPricePerMillion: 10,
    features: ['vision'],
    contextWindow: 128_000,
  },
  'gpt-4o-mini': {
    displayName: 'GPT-4o Mini',
    description: 'Fast and affordable GPT-4o variant',
    provider: 'openai',
    knowledgeCutoff: 'Oct 2023',
    priceTier: '$',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.6,
    features: ['vision'],
    contextWindow: 128_000,
  },

  // ---------------------------------------------------------------------------
  // OpenAI - o-series reasoning
  // ---------------------------------------------------------------------------
  o3: {
    displayName: 'o3',
    description: 'Powerful OpenAI reasoning model',
    provider: 'openai',
    knowledgeCutoff: 'Mar 2025',
    priceTier: '$$',
    inputPricePerMillion: 2,
    outputPricePerMillion: 8,
    features: ['vision', 'reasoning'],
    reasoningLevels: OPENAI_REASONING,
    contextWindow: 200_000,
  },
  'o4-mini': {
    displayName: 'o4-mini',
    description: 'Small OpenAI reasoning model with strong value',
    provider: 'openai',
    knowledgeCutoff: 'Jun 2024',
    priceTier: '$$',
    inputPricePerMillion: 1.1,
    outputPricePerMillion: 4.4,
    features: ['vision', 'reasoning'],
    reasoningLevels: OPENAI_REASONING,
    contextWindow: 200_000,
  },
  'o3-mini': {
    displayName: 'o3-mini',
    description: 'Efficient previous-generation reasoning model',
    provider: 'openai',
    knowledgeCutoff: 'Oct 2023',
    priceTier: '$$',
    inputPricePerMillion: 1.1,
    outputPricePerMillion: 4.4,
    features: ['reasoning'],
    reasoningLevels: OPENAI_REASONING,
    contextWindow: 200_000,
  },

  // ---------------------------------------------------------------------------
  // Anthropic - Claude 4.x
  // ---------------------------------------------------------------------------
  'claude-opus-4-7': {
    displayName: 'Claude Opus 4.7',
    description: 'Most capable Claude for complex reasoning and agentic coding',
    provider: 'anthropic',
    knowledgeCutoff: 'Jan 2026',
    priceTier: '$$$$',
    inputPricePerMillion: 5,
    outputPricePerMillion: 25,
    features: ['vision', 'reasoning'],
    reasoningLevels: ANTHROPIC_OPUS_47_REASONING,
    contextWindow: 1_000_000,
  },
  'claude-opus-4-6': {
    displayName: 'Claude Opus 4.6',
    description: 'High-end Claude model for agents, coding, and knowledge work',
    provider: 'anthropic',
    priceTier: '$$$$',
    inputPricePerMillion: 5,
    outputPricePerMillion: 25,
    features: ['vision', 'reasoning'],
    reasoningLevels: STANDARD_REASONING,
    contextWindow: 1_000_000,
  },
  'claude-opus-4-5': {
    displayName: 'Claude Opus 4.5',
    description: 'Previous Opus model for difficult reasoning work',
    provider: 'anthropic',
    priceTier: '$$$$',
    inputPricePerMillion: 5,
    outputPricePerMillion: 25,
    features: ['vision', 'reasoning'],
    reasoningLevels: STANDARD_REASONING,
    contextWindow: 200_000,
  },
  'claude-opus-4-1': {
    displayName: 'Claude Opus 4.1',
    description: 'Previous high-intelligence Claude Opus model',
    provider: 'anthropic',
    priceTier: '$$$$',
    inputPricePerMillion: 15,
    outputPricePerMillion: 75,
    features: ['vision', 'reasoning'],
    reasoningLevels: STANDARD_REASONING,
    contextWindow: 200_000,
  },
  'claude-opus-4': {
    displayName: 'Claude Opus 4',
    description: 'Legacy Claude Opus 4 model',
    provider: 'anthropic',
    knowledgeCutoff: 'Mar 2025',
    priceTier: '$$$$',
    inputPricePerMillion: 15,
    outputPricePerMillion: 75,
    features: ['vision', 'reasoning'],
    reasoningLevels: STANDARD_REASONING,
    contextWindow: 200_000,
  },
  'claude-sonnet-4-6': {
    displayName: 'Claude Sonnet 4.6',
    description: 'Best balance of Claude speed and intelligence',
    provider: 'anthropic',
    knowledgeCutoff: 'Aug 2025',
    priceTier: '$$$',
    inputPricePerMillion: 3,
    outputPricePerMillion: 15,
    features: ['vision', 'reasoning'],
    reasoningLevels: STANDARD_REASONING,
    contextWindow: 1_000_000,
  },
  'claude-sonnet-4-5': {
    displayName: 'Claude Sonnet 4.5',
    description: 'Previous strong Sonnet model for coding and agents',
    provider: 'anthropic',
    priceTier: '$$$',
    inputPricePerMillion: 3,
    outputPricePerMillion: 15,
    features: ['vision', 'reasoning'],
    reasoningLevels: STANDARD_REASONING,
    contextWindow: 200_000,
  },
  'claude-sonnet-4': {
    displayName: 'Claude Sonnet 4',
    description: 'Strong all-around Claude model with vision',
    provider: 'anthropic',
    knowledgeCutoff: 'Mar 2025',
    priceTier: '$$$',
    inputPricePerMillion: 3,
    outputPricePerMillion: 15,
    features: ['vision', 'reasoning'],
    reasoningLevels: STANDARD_REASONING,
    contextWindow: 200_000,
  },
  'claude-haiku-4-5': {
    displayName: 'Claude Haiku 4.5',
    description: 'Fast Claude model with near-frontier intelligence',
    provider: 'anthropic',
    knowledgeCutoff: 'Feb 2025',
    priceTier: '$$',
    inputPricePerMillion: 1,
    outputPricePerMillion: 5,
    features: ['vision', 'reasoning'],
    reasoningLevels: STANDARD_REASONING,
    contextWindow: 200_000,
  },

  // ---------------------------------------------------------------------------
  // Anthropic - Claude 3.x
  // ---------------------------------------------------------------------------
  'claude-3-7-sonnet': {
    displayName: 'Claude 3.7 Sonnet',
    description: 'Previous-generation Sonnet with extended thinking',
    provider: 'anthropic',
    knowledgeCutoff: 'Oct 2024',
    priceTier: '$$$',
    inputPricePerMillion: 3,
    outputPricePerMillion: 15,
    features: ['vision', 'reasoning'],
    reasoningLevels: STANDARD_REASONING,
    contextWindow: 200_000,
  },
  'claude-3-5-sonnet': {
    displayName: 'Claude 3.5 Sonnet',
    description: 'Legacy high-performance Claude Sonnet model',
    provider: 'anthropic',
    knowledgeCutoff: 'Apr 2024',
    priceTier: '$$$',
    inputPricePerMillion: 3,
    outputPricePerMillion: 15,
    features: ['vision'],
    contextWindow: 200_000,
  },
  'claude-3-5-haiku': {
    displayName: 'Claude 3.5 Haiku',
    description: 'Legacy fast Claude model',
    provider: 'anthropic',
    knowledgeCutoff: 'Jul 2024',
    priceTier: '$',
    inputPricePerMillion: 0.8,
    outputPricePerMillion: 4,
    features: ['vision'],
    contextWindow: 200_000,
  },

  // ---------------------------------------------------------------------------
  // Google - Gemini 3.x
  // ---------------------------------------------------------------------------
  'gemini-3.1-pro-preview': {
    displayName: 'Gemini 3.1 Pro Preview',
    description: 'Advanced Gemini model for complex reasoning and agentic work',
    provider: 'google',
    knowledgeCutoff: 'Jan 2025',
    priceTier: '$$$',
    features: ['vision', 'reasoning'],
    reasoningLevels: GEMINI_3_REASONING,
    contextWindow: 1_048_576,
  },
  'gemini-3.1-pro-preview-customtools': {
    displayName: 'Gemini 3.1 Pro Preview Custom Tools',
    description: 'Gemini 3.1 Pro endpoint tuned for custom-tool workflows',
    provider: 'google',
    knowledgeCutoff: 'Jan 2025',
    priceTier: '$$$',
    features: ['vision', 'reasoning'],
    reasoningLevels: GEMINI_3_REASONING,
    contextWindow: 1_048_576,
  },
  'gemini-3-flash-preview': {
    displayName: 'Gemini 3 Flash Preview',
    description: 'Fast Gemini 3 model with frontier-class multimodal reasoning',
    provider: 'google',
    knowledgeCutoff: 'Jan 2025',
    priceTier: '$$',
    features: ['vision', 'reasoning'],
    reasoningLevels: GEMINI_3_REASONING,
    contextWindow: 1_048_576,
  },
  'gemini-3.1-flash-lite-preview': {
    displayName: 'Gemini 3.1 Flash-Lite Preview',
    description: 'Lowest-latency Gemini 3.1 model for high-volume tasks',
    provider: 'google',
    knowledgeCutoff: 'Jan 2025',
    priceTier: '$',
    features: ['vision', 'reasoning'],
    reasoningLevels: GEMINI_3_REASONING,
    contextWindow: 1_048_576,
  },
  'gemini-pro-latest': {
    displayName: 'Gemini Pro Latest',
    description: 'Google alias for the latest Gemini Pro release',
    provider: 'google',
    knowledgeCutoff: 'Jan 2025',
    priceTier: '$$$',
    features: ['vision', 'reasoning'],
    reasoningLevels: GEMINI_3_REASONING,
    contextWindow: 1_048_576,
  },
  'gemini-flash-latest': {
    displayName: 'Gemini Flash Latest',
    description: 'Google alias for the latest Gemini Flash release',
    provider: 'google',
    knowledgeCutoff: 'Jan 2025',
    priceTier: '$$',
    features: ['vision', 'reasoning'],
    reasoningLevels: GEMINI_3_REASONING,
    contextWindow: 1_048_576,
  },
  'gemini-flash-lite-latest': {
    displayName: 'Gemini Flash-Lite Latest',
    description: 'Google alias for the latest Gemini Flash-Lite release',
    provider: 'google',
    knowledgeCutoff: 'Jan 2025',
    priceTier: '$',
    features: ['vision', 'reasoning'],
    reasoningLevels: GEMINI_3_REASONING,
    contextWindow: 1_048_576,
  },

  // ---------------------------------------------------------------------------
  // Google - Gemini 2.x
  // ---------------------------------------------------------------------------
  'gemini-2.5-pro': {
    displayName: 'Gemini 2.5 Pro',
    description: 'Stable Gemini thinking model for complex tasks',
    provider: 'google',
    knowledgeCutoff: 'Jan 2025',
    priceTier: '$$$',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 10,
    features: ['vision', 'reasoning'],
    reasoningLevels: STANDARD_REASONING,
    contextWindow: 1_048_576,
  },
  'gemini-2.5-flash': {
    displayName: 'Gemini 2.5 Flash',
    description: 'Stable Gemini model with strong price-performance',
    provider: 'google',
    knowledgeCutoff: 'Jan 2025',
    priceTier: '$',
    inputPricePerMillion: 0.3,
    outputPricePerMillion: 2.5,
    features: ['vision', 'reasoning'],
    reasoningLevels: STANDARD_REASONING,
    contextWindow: 1_048_576,
  },
  'gemini-2.5-flash-lite': {
    displayName: 'Gemini 2.5 Flash-Lite',
    description: 'Fastest stable Gemini 2.5 model for cost-sensitive work',
    provider: 'google',
    knowledgeCutoff: 'Jan 2025',
    priceTier: '$',
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0.4,
    features: ['vision', 'reasoning'],
    reasoningLevels: STANDARD_REASONING,
    contextWindow: 1_048_576,
  },
  'gemini-2.0-flash': {
    displayName: 'Gemini 2.0 Flash',
    description: 'Deprecated previous-generation Gemini Flash model',
    provider: 'google',
    knowledgeCutoff: 'Aug 2024',
    priceTier: '$',
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0.4,
    features: ['vision'],
    contextWindow: 1_048_576,
  },
  'gemini-2.0-flash-lite': {
    displayName: 'Gemini 2.0 Flash-Lite',
    description: 'Deprecated previous-generation lightweight Gemini model',
    provider: 'google',
    knowledgeCutoff: 'Aug 2024',
    priceTier: '$',
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.3,
    features: ['vision'],
    contextWindow: 1_048_576,
  },
}

/**
 * Look up curated metadata for a model ID.
 * Tries exact match first, then prefix matching for versioned IDs
 * (e.g. `claude-3-5-sonnet-20241022` matches `claude-3-5-sonnet`).
 */
export function getModelMetadata(modelId: string): ModelMetadata | undefined {
  return getModelMetadataMatch(modelId)?.metadata
}

function isDelimitedVariant(modelId: string, key: string): boolean {
  const nextChar = modelId[key.length]
  return (
    nextChar === '-' || nextChar === '_' || nextChar === '.' || nextChar === ':' || nextChar === '/'
  )
}

export function getModelMetadataMatch(modelId: string): ModelMetadataMatch | undefined {
  if (MODEL_REGISTRY[modelId]) {
    return {
      key: modelId,
      metadata: MODEL_REGISTRY[modelId],
      isExact: true,
    }
  }

  // Prefix match: find the longest delimiter-aware key.
  // This handles date-suffixed IDs without matching unrelated IDs by accident.
  let best: ModelMetadata | undefined
  let bestKey = ''
  let bestLen = 0
  for (const [key, meta] of Object.entries(MODEL_REGISTRY)) {
    if (modelId.startsWith(key) && isDelimitedVariant(modelId, key) && key.length > bestLen) {
      best = meta
      bestKey = key
      bestLen = key.length
    }
  }

  if (!best) return undefined

  return {
    key: bestKey,
    metadata: best,
    isExact: false,
  }
}
