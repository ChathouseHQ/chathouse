import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

import { deriveKey } from './derive-key.js'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const SALT_LENGTH = 16

function deriveEncryptionKey(salt: Buffer): Buffer {
  return scryptSync(deriveKey('encryption'), salt, KEY_LENGTH)
}

export function encrypt(text: string): string {
  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  const key = deriveEncryptionKey(salt)

  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':')
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted text format')
  }

  const [saltHex, ivHex, authTagHex, encrypted] = parts

  const salt = Buffer.from(saltHex, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const key = deriveEncryptionKey(salt)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
