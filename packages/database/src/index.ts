export { createDbClient, parseConnectionString } from './client.js'
export { deriveKey } from './derive-key.js'
export { encrypt, decrypt } from './encryption.js'
export type {
  Provider,
  ChatJobData,
  TitleJobData,
  ModelRefreshJobData,
  ReasoningLevel,
} from './types.js'
export {
  PROVIDERS,
  PROVIDER_NAMES,
  isProvider,
  REASONING_LEVELS,
  isReasoningLevel,
} from './types.js'
export {
  getModelMetadata,
  getModelMetadataMatch,
  type ModelMetadata,
  type ModelMetadataMatch,
  type ModelFeature,
  type PriceTier,
} from './model-registry.js'

import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
export const PrismaClient = require('../generated/prisma/client.js').PrismaClient

export type * from '../generated/prisma/client.js'
