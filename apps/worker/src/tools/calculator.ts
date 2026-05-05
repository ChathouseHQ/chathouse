import { jsonSchema, tool } from 'ai'

interface CalculateInput {
  expression: string
}

interface CalculateOutput {
  expression: string
  result?: number
  error?: string
}

interface ConvertUnitsInput {
  value: number
  from: string
  to: string
}

interface ConvertUnitsOutput {
  value: number
  from: string
  to: string
  result?: number
  error?: string
}

const calculateInputSchema = jsonSchema<CalculateInput>({
  type: 'object',
  properties: {
    expression: {
      type: 'string',
      minLength: 1,
      maxLength: 300,
      description:
        'Arithmetic expression using numbers, parentheses, +, -, *, /, %, ^, and math functions like sqrt, pow, abs, min, max, round, floor, ceil, sin, cos, tan, log, ln.',
    },
  },
  required: ['expression'],
  additionalProperties: false,
})

const convertUnitsInputSchema = jsonSchema<ConvertUnitsInput>({
  type: 'object',
  properties: {
    value: { type: 'number', description: 'Numeric value to convert.' },
    from: { type: 'string', description: 'Source unit, such as km, mi, kg, lb, c, f, usd.' },
    to: { type: 'string', description: 'Target unit, such as km, mi, kg, lb, c, f, usd.' },
  },
  required: ['value', 'from', 'to'],
  additionalProperties: false,
})

type Token =
  | { type: 'number'; value: number }
  | { type: 'identifier'; value: string }
  | { type: 'operator'; value: '+' | '-' | '*' | '/' | '%' | '^' }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'comma'; value: ',' }

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
}

const FUNCTIONS: Record<string, (...values: number[]) => number> = {
  abs: Math.abs,
  acos: Math.acos,
  asin: Math.asin,
  atan: Math.atan,
  ceil: Math.ceil,
  cos: Math.cos,
  exp: Math.exp,
  floor: Math.floor,
  ln: Math.log,
  log: Math.log10,
  max: Math.max,
  min: Math.min,
  pow: Math.pow,
  round: Math.round,
  sin: Math.sin,
  sqrt: Math.sqrt,
  tan: Math.tan,
}

const UNIT_FACTORS: Record<string, { dimension: string; toBase: number }> = {
  mm: { dimension: 'length', toBase: 0.001 },
  cm: { dimension: 'length', toBase: 0.01 },
  m: { dimension: 'length', toBase: 1 },
  km: { dimension: 'length', toBase: 1000 },
  in: { dimension: 'length', toBase: 0.0254 },
  ft: { dimension: 'length', toBase: 0.3048 },
  yd: { dimension: 'length', toBase: 0.9144 },
  mi: { dimension: 'length', toBase: 1609.344 },
  g: { dimension: 'mass', toBase: 0.001 },
  kg: { dimension: 'mass', toBase: 1 },
  oz: { dimension: 'mass', toBase: 0.028349523125 },
  lb: { dimension: 'mass', toBase: 0.45359237 },
  ml: { dimension: 'volume', toBase: 0.001 },
  l: { dimension: 'volume', toBase: 1 },
  tsp: { dimension: 'volume', toBase: 0.00492892159375 },
  tbsp: { dimension: 'volume', toBase: 0.01478676478125 },
  cup: { dimension: 'volume', toBase: 0.2365882365 },
  pt: { dimension: 'volume', toBase: 0.473176473 },
  qt: { dimension: 'volume', toBase: 0.946352946 },
  gal: { dimension: 'volume', toBase: 3.785411784 },
}

const UNIT_ALIASES: Record<string, string> = {
  kilometer: 'km',
  kilometers: 'km',
  metre: 'm',
  metres: 'm',
  meter: 'm',
  meters: 'm',
  mile: 'mi',
  miles: 'mi',
  gram: 'g',
  grams: 'g',
  kilogram: 'kg',
  kilograms: 'kg',
  ounce: 'oz',
  ounces: 'oz',
  pound: 'lb',
  pounds: 'lb',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  celsius: 'c',
  fahrenheit: 'f',
  kelvin: 'k',
}

export function calculateExpression(expression: string): CalculateOutput {
  try {
    const parser = new ExpressionParser(tokenize(expression))
    const result = parser.parse()
    if (!Number.isFinite(result)) {
      return { expression, error: 'Expression did not produce a finite number.' }
    }
    return { expression, result }
  } catch (reason) {
    return {
      expression,
      error: reason instanceof Error ? reason.message : 'Invalid expression.',
    }
  }
}

export function convertUnits(input: ConvertUnitsInput): ConvertUnitsOutput {
  const from = normalizeUnit(input.from)
  const to = normalizeUnit(input.to)

  if (from === to) return { ...input, result: input.value }

  const temperature = convertTemperature(input.value, from, to)
  if (temperature != null) {
    return { ...input, result: temperature }
  }

  const fromUnit = UNIT_FACTORS[from]
  const toUnit = UNIT_FACTORS[to]
  if (!fromUnit || !toUnit) {
    return { ...input, error: `Unsupported unit conversion: ${input.from} to ${input.to}.` }
  }
  if (fromUnit.dimension !== toUnit.dimension) {
    return { ...input, error: `Cannot convert ${input.from} to ${input.to}.` }
  }

  return {
    ...input,
    result: (input.value * fromUnit.toBase) / toUnit.toBase,
  }
}

export function buildCalculatorTools() {
  return {
    calculate: tool({
      description:
        'Evaluate exact arithmetic and math expressions. Use for numeric calculations instead of doing arithmetic mentally.',
      inputSchema: calculateInputSchema,
      execute: async ({ expression }) => calculateExpression(expression),
    }),
    convert_units: tool({
      description:
        'Convert common length, mass, volume, and temperature units. Use when the user asks for unit conversion.',
      inputSchema: convertUnitsInputSchema,
      execute: async (input) => convertUnits(input),
    }),
  }
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = []
  let index = 0

  while (index < expression.length) {
    const char = expression[index]
    if (/\s/.test(char)) {
      index += 1
      continue
    }

    if (/[0-9.]/.test(char)) {
      const match = expression.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i)
      if (!match) throw new Error(`Invalid number near "${expression.slice(index, index + 8)}".`)
      tokens.push({ type: 'number', value: Number(match[0]) })
      index += match[0].length
      continue
    }

    if (/[A-Za-z_]/.test(char)) {
      const match = expression.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/)
      if (!match) throw new Error(`Invalid identifier near "${expression.slice(index)}".`)
      tokens.push({ type: 'identifier', value: match[0].toLowerCase() })
      index += match[0].length
      continue
    }

    if ('+-*/%^'.includes(char)) {
      tokens.push({
        type: 'operator',
        value: char as Extract<Token, { type: 'operator' }>['value'],
      })
      index += 1
      continue
    }

    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char })
      index += 1
      continue
    }

    if (char === ',') {
      tokens.push({ type: 'comma', value: ',' })
      index += 1
      continue
    }

    throw new Error(`Unsupported character "${char}".`)
  }

  return tokens
}

class ExpressionParser {
  private index = 0

  constructor(private readonly tokens: Token[]) {}

  parse(): number {
    const value = this.parseExpression()
    if (this.peek()) throw new Error('Unexpected trailing input.')
    return value
  }

  private parseExpression(): number {
    let value = this.parseTerm()
    while (this.matchOperator('+') || this.matchOperator('-')) {
      const operator = this.previous().value
      const right = this.parseTerm()
      value = operator === '+' ? value + right : value - right
    }
    return value
  }

  private parseTerm(): number {
    let value = this.parsePower()
    while (this.matchOperator('*') || this.matchOperator('/') || this.matchOperator('%')) {
      const operator = this.previous().value
      const right = this.parsePower()
      if (operator === '*') value *= right
      else if (operator === '/') value /= right
      else value %= right
    }
    return value
  }

  private parsePower(): number {
    const value = this.parseUnary()
    if (!this.matchOperator('^')) return value
    return value ** this.parsePower()
  }

  private parseUnary(): number {
    if (this.matchOperator('+')) return this.parseUnary()
    if (this.matchOperator('-')) return -this.parseUnary()
    return this.parsePrimary()
  }

  private parsePrimary(): number {
    const token = this.advance()
    if (!token) throw new Error('Expected a number, constant, or function call.')

    if (token.type === 'number') return token.value

    if (token.type === 'identifier') {
      if (this.matchParen('(')) {
        const args: number[] = []
        if (!this.checkParen(')')) {
          do {
            args.push(this.parseExpression())
          } while (this.matchComma())
        }
        this.consumeParen(')')
        const fn = FUNCTIONS[token.value]
        if (!fn) throw new Error(`Unsupported function "${token.value}".`)
        return fn(...args)
      }

      const constant = CONSTANTS[token.value]
      if (constant == null) throw new Error(`Unsupported identifier "${token.value}".`)
      return constant
    }

    if (token.type === 'paren' && token.value === '(') {
      const value = this.parseExpression()
      this.consumeParen(')')
      return value
    }

    throw new Error('Expected a number, constant, or function call.')
  }

  private matchOperator(value: Extract<Token, { type: 'operator' }>['value']) {
    const token = this.peek()
    if (token?.type !== 'operator' || token.value !== value) return false
    this.index += 1
    return true
  }

  private matchParen(value: '(' | ')') {
    const token = this.peek()
    if (token?.type !== 'paren' || token.value !== value) return false
    this.index += 1
    return true
  }

  private checkParen(value: '(' | ')') {
    const token = this.peek()
    return token?.type === 'paren' && token.value === value
  }

  private consumeParen(value: '(' | ')') {
    if (!this.matchParen(value)) throw new Error(`Expected "${value}".`)
  }

  private matchComma() {
    const token = this.peek()
    if (token?.type !== 'comma') return false
    this.index += 1
    return true
  }

  private previous() {
    return this.tokens[this.index - 1] as Extract<Token, { type: 'operator' }>
  }

  private peek(): Token | undefined {
    return this.tokens[this.index]
  }

  private advance(): Token | undefined {
    const token = this.peek()
    if (token) this.index += 1
    return token
  }
}

function normalizeUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase().replace(/[°.]/g, '')
  return UNIT_ALIASES[normalized] ?? normalized
}

function convertTemperature(value: number, from: string, to: string): number | undefined {
  const temperatureUnits = new Set(['c', 'f', 'k'])
  if (!temperatureUnits.has(from) || !temperatureUnits.has(to)) return undefined

  const celsius = from === 'c' ? value : from === 'f' ? (value - 32) * (5 / 9) : value - 273.15

  if (to === 'c') return celsius
  if (to === 'f') return celsius * (9 / 5) + 32
  return celsius + 273.15
}
