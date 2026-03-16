import { hash as bcryptHash, compare } from 'bcryptjs'
import { randomBytes } from 'crypto'
import { generateSecret, verify, generateURI } from 'otplib'

import { db } from './db.server'

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcryptHash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return compare(password, hash)
}

export async function createUser(email: string, password: string, name?: string) {
  const passwordHash = await hashPassword(password)

  const user = await db.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      name,
      settings: {
        create: {},
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      totpEnabled: true,
    },
  })

  const userCount = await db.user.count()
  if (userCount === 1) {
    await db.appSettings.upsert({
      where: { id: 'app' },
      create: {
        id: 'app',
        registrationEnabled: false,
        setupComplete: true,
      },
      update: {
        registrationEnabled: false,
        setupComplete: true,
      },
    })
  }

  return user
}

export async function findUserByEmail(email: string) {
  return db.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      totpEnabled: true,
      totpSecret: true,
    },
  })
}

export async function isRegistrationEnabled(): Promise<boolean> {
  const settings = await db.appSettings.findUnique({
    where: { id: 'app' },
  })

  return settings?.registrationEnabled ?? true
}

export async function setRegistrationEnabled(enabled: boolean): Promise<void> {
  await db.appSettings.upsert({
    where: { id: 'app' },
    create: {
      id: 'app',
      registrationEnabled: enabled,
      setupComplete: true,
    },
    update: {
      registrationEnabled: enabled,
    },
  })
}

export function generateTotpSecret(): string {
  return generateSecret()
}

export function generateTotpUri(secret: string, email: string): string {
  return generateURI({
    issuer: 'Chathouse',
    label: email,
    secret,
  })
}

export async function verifyTotpToken(secret: string, token: string): Promise<boolean> {
  const result = await verify({ secret, token })
  return result.valid
}

export async function enableTotp(userId: string, secret: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: {
      totpSecret: secret,
      totpEnabled: true,
    },
  })
}

export async function disableTotp(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: {
      totpSecret: null,
      totpEnabled: false,
    },
  })
}

const RESET_TOKEN_EXPIRY_MINUTES = 30

export async function createPasswordResetToken(email: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  })

  if (!user) return null

  await db.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  })

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000)

  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  })

  return token
}

export async function validatePasswordResetToken(token: string) {
  const resetToken = await db.passwordResetToken.findUnique({
    where: { token },
    include: {
      user: { select: { id: true, email: true } },
    },
  })

  if (!resetToken) return null
  if (resetToken.usedAt) return null
  if (resetToken.expiresAt < new Date()) return null

  return resetToken
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
  const resetToken = await validatePasswordResetToken(token)
  if (!resetToken) return false

  const passwordHash = await hashPassword(newPassword)

  await db.$transaction([
    db.user.update({
      where: { id: resetToken.user.id },
      data: { passwordHash },
    }),
    db.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    db.session.deleteMany({
      where: { userId: resetToken.user.id },
    }),
  ])

  return true
}
