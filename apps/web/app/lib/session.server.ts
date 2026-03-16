import { redirect } from 'react-router'
import { v4 as uuidv4 } from 'uuid'

import { db } from './db.server'

const SESSION_COOKIE_NAME = 'chathouse_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days in seconds

interface SessionUser {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  totpEnabled: boolean
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!cookieHeader) return cookies

  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.split('=')
    if (name) {
      cookies[name.trim()] = rest.join('=').trim()
    }
  })

  return cookies
}

function getSessionId(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie')
  const cookies = parseCookies(cookieHeader)
  return cookies[SESSION_COOKIE_NAME] || null
}

export async function createSession(userId: string): Promise<string> {
  const sessionId = uuidv4()
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000)

  await db.session.create({
    data: {
      id: sessionId,
      userId,
      expiresAt,
    },
  })

  return sessionId
}

export async function getSession(request: Request): Promise<SessionUser | null> {
  const sessionId = getSessionId(request)
  if (!sessionId) return null

  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          totpEnabled: true,
        },
      },
    },
  })

  if (!session) return null

  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: sessionId } })
    return null
  }

  return session.user
}

export async function requireAuth(request: Request): Promise<SessionUser> {
  const user = await getSession(request)
  if (!user) {
    throw redirect('/login')
  }
  return user
}

export async function destroySession(request: Request): Promise<void> {
  const sessionId = getSessionId(request)
  if (sessionId) {
    await db.session.delete({ where: { id: sessionId } }).catch(() => {
      // Session might already be deleted
    })
  }
}

export function createSessionCookie(sessionId: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`
}

export function createLogoutCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}
