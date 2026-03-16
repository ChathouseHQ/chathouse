import crypto from 'crypto'

type Purpose = 'encryption' | 'session'

/**
 * Derives a purpose-specific key from SECRET_KEY_BASE using HKDF.
 * In dev/test, falls back to a deterministic (but insecure) key so the
 * app can boot without the env var set.
 */
export function deriveKey(purpose: Purpose, length = 32): string {
  const baseStr = process.env.SECRET_KEY_BASE

  if (!baseStr) {
    const env = process.env.NODE_ENV
    if (env === 'development' || env === 'test') {
      return crypto
        .createHash('sha256')
        .update(`dev:${purpose}`)
        .digest('hex')
        .substring(0, length * 2)
    }

    throw new Error(
      'SECRET_KEY_BASE environment variable is not set. ' +
        'This would make derived secrets predictable.',
    )
  }

  const base = Buffer.from(baseStr, 'utf8')
  const info = Buffer.from(purpose, 'utf8')
  return Buffer.from(crypto.hkdfSync('sha256', base, Buffer.alloc(0), info, length)).toString('hex')
}
