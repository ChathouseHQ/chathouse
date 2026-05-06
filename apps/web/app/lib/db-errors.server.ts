function stringifyUnknown(value: unknown): string {
  if (!value || typeof value !== 'object') return String(value)

  const parts = value instanceof Error ? [value.name, value.message] : []

  try {
    parts.push(JSON.stringify(value))
  } catch {
    parts.push(Object.prototype.toString.call(value))
  }

  return parts.join(' ')
}

export function isMissingColumnError(error: unknown, columnName: string): boolean {
  const text = stringifyUnknown(error)

  return (
    text.includes(columnName) &&
    (/unknown column/i.test(text) ||
      /no such column/i.test(text) ||
      /column .*does not exist/i.test(text) ||
      /\b1054\b/.test(text) ||
      /\bP2022\b/.test(text))
  )
}
