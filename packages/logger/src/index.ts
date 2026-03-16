export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogMethod = (...args: unknown[]) => void

type Logger = {
  debug: LogMethod
  info: LogMethod
  warn: LogMethod
  error: LogMethod
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const LOG_METHODS: Record<LogLevel, (...args: unknown[]) => void> = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
}

function isLogLevel(value: string): value is LogLevel {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error'
}

function resolveLogLevel(): LogLevel {
  const configuredLevel = process.env.LOG_LEVEL?.toLowerCase()

  if (configuredLevel && isLogLevel(configuredLevel)) {
    return configuredLevel
  }

  return process.env.NODE_ENV === 'production' ? 'error' : 'debug'
}

function shouldLog(level: LogLevel): boolean {
  const activeLevel = resolveLogLevel()
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[activeLevel]
}

function formatPrefix(level: LogLevel, scope?: string): string {
  const parts = [new Date().toISOString(), level.toUpperCase()]

  if (scope) {
    parts.push(scope)
  }

  return `[${parts.join('] [')}]`
}

function log(level: LogLevel, scope: string | undefined, args: unknown[]): void {
  if (!shouldLog(level)) {
    return
  }

  LOG_METHODS[level](formatPrefix(level, scope), ...args)
}

export function createLogger(scope?: string): Logger {
  return {
    debug: (...args) => log('debug', scope, args),
    info: (...args) => log('info', scope, args),
    warn: (...args) => log('warn', scope, args),
    error: (...args) => log('error', scope, args),
  }
}

export const logger = createLogger()
