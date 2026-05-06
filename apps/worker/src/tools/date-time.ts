import { jsonSchema, tool } from 'ai'

interface CurrentTimeInput {
  timeZone?: string
}

interface CurrentTimeOutput {
  now: string
  timeZone: string
  formatted: string
  unixMs: number
}

interface DateMathInput {
  baseDate?: string
  amount: number
  unit: 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'
  operation?: 'add' | 'subtract'
  timeZone?: string
}

interface DateDifferenceInput {
  from: string
  to: string
  unit?: 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks'
}

const currentTimeInputSchema = jsonSchema<CurrentTimeInput>({
  type: 'object',
  properties: {
    timeZone: {
      type: 'string',
      description: 'Optional IANA time zone, such as America/New_York or Europe/London.',
    },
  },
  additionalProperties: false,
})

const dateMathInputSchema = jsonSchema<DateMathInput>({
  type: 'object',
  properties: {
    baseDate: {
      type: 'string',
      description:
        'Optional base date/time as an ISO string or parseable date. Defaults to the current time.',
    },
    amount: { type: 'number', description: 'Number of units to add or subtract.' },
    unit: {
      type: 'string',
      enum: ['milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'],
      description: 'Date/time unit to apply.',
    },
    operation: {
      type: 'string',
      enum: ['add', 'subtract'],
      description: 'Whether to add or subtract the amount. Defaults to add.',
    },
    timeZone: {
      type: 'string',
      description: 'Optional IANA time zone used for the formatted result.',
    },
  },
  required: ['amount', 'unit'],
  additionalProperties: false,
})

const dateDifferenceInputSchema = jsonSchema<DateDifferenceInput>({
  type: 'object',
  properties: {
    from: { type: 'string', description: 'Start date/time as an ISO string or parseable date.' },
    to: { type: 'string', description: 'End date/time as an ISO string or parseable date.' },
    unit: {
      type: 'string',
      enum: ['milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks'],
      description: 'Output unit. Defaults to days.',
    },
  },
  required: ['from', 'to'],
  additionalProperties: false,
})

function getCurrentTime(input: CurrentTimeInput = {}): CurrentTimeOutput {
  const now = new Date()
  const timeZone = input.timeZone || 'UTC'

  return {
    now: now.toISOString(),
    timeZone,
    formatted: formatDate(now, timeZone),
    unixMs: now.getTime(),
  }
}

export function applyDateMath(input: DateMathInput) {
  const base = parseDate(input.baseDate ?? new Date().toISOString(), 'baseDate')
  const multiplier = input.operation === 'subtract' ? -1 : 1
  const amount = input.amount * multiplier
  const result = new Date(base)

  switch (input.unit) {
    case 'milliseconds':
      result.setTime(result.getTime() + amount)
      break
    case 'seconds':
      result.setTime(result.getTime() + amount * 1000)
      break
    case 'minutes':
      result.setTime(result.getTime() + amount * 60 * 1000)
      break
    case 'hours':
      result.setTime(result.getTime() + amount * 60 * 60 * 1000)
      break
    case 'days':
      result.setUTCDate(result.getUTCDate() + amount)
      break
    case 'weeks':
      result.setUTCDate(result.getUTCDate() + amount * 7)
      break
    case 'months': {
      const originalDay = result.getUTCDate()
      const targetYear = result.getUTCFullYear()
      const targetMonth = result.getUTCMonth() + amount
      const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
      result.setUTCDate(1)
      result.setUTCFullYear(targetYear, targetMonth, Math.min(originalDay, lastDay))
      break
    }
    case 'years': {
      const originalDay = result.getUTCDate()
      const targetYear = result.getUTCFullYear() + amount
      const targetMonth = result.getUTCMonth()
      const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
      result.setUTCDate(1)
      result.setUTCFullYear(targetYear, targetMonth, Math.min(originalDay, lastDay))
      break
    }
  }

  const timeZone = input.timeZone || 'UTC'
  return {
    baseDate: base.toISOString(),
    operation: input.operation ?? 'add',
    amount: input.amount,
    unit: input.unit,
    result: result.toISOString(),
    formatted: formatDate(result, timeZone),
    timeZone,
  }
}

export function getDateDifference(input: DateDifferenceInput) {
  const from = parseDate(input.from, 'from')
  const to = parseDate(input.to, 'to')
  const unit = input.unit ?? 'days'
  const milliseconds = to.getTime() - from.getTime()

  const divisor = {
    milliseconds: 1,
    seconds: 1000,
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
  }[unit]

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    unit,
    value: milliseconds / divisor,
    milliseconds,
  }
}

export function buildDateTimeTools() {
  return {
    current_time: tool({
      description:
        'Get the exact current date and time. Use for current time, today, yesterday/tomorrow anchoring, or time zone questions.',
      inputSchema: currentTimeInputSchema,
      execute: async (input) => getCurrentTime(input),
    }),
    date_math: tool({
      description:
        'Add or subtract time from a date. Use for deadlines, calendar math, and relative date calculations.',
      inputSchema: dateMathInputSchema,
      execute: async (input) => applyDateMath(input),
    }),
    date_difference: tool({
      description: 'Calculate the exact difference between two dates or times.',
      inputSchema: dateDifferenceInputSchema,
      execute: async (input) => getDateDifference(input),
    }),
  }
}

function parseDate(value: string, field: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${field}: ${value}`)
  }
  return date
}

function formatDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'long',
    timeZone,
  }).format(date)
}
