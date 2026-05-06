import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { calculateExpression, convertUnits } from '../src/tools/calculator.ts'
import { applyDateMath, getDateDifference } from '../src/tools/date-time.ts'

describe('calculator tools', () => {
  it('evaluates arithmetic with precedence and functions', () => {
    assert.equal(calculateExpression('2 + 3 * 4').result, 14)
    assert.equal(calculateExpression('sqrt(81) + pow(2, 3)').result, 17)
    assert.equal(calculateExpression('2 ^ 3 ^ 2').result, 512)
    assert.equal(calculateExpression('-2 ^ 2').result, -4)
    assert.equal(calculateExpression('2 ^ -2').result, 0.25)
  })

  it('rejects unsupported expressions', () => {
    const result = calculateExpression('process.exit()')
    assert.equal(result.result, undefined)
    assert.match(result.error ?? '', /Unsupported|Invalid/)
  })

  it('converts common units and temperatures', () => {
    assert.equal(convertUnits({ value: 1, from: 'km', to: 'm' }).result, 1000)
    assert.equal(convertUnits({ value: 32, from: 'fahrenheit', to: 'celsius' }).result, 0)
    assert.equal(convertUnits({ value: 2, from: 'kg', to: 'lb' }).result?.toFixed(4), '4.4092')
  })
})

describe('date and time tools', () => {
  it('adds calendar units', () => {
    const result = applyDateMath({
      baseDate: '2026-05-05T12:00:00.000Z',
      amount: 2,
      unit: 'weeks',
    })

    assert.equal(result.result, '2026-05-19T12:00:00.000Z')
  })

  it('clamps overflowing calendar months and years', () => {
    assert.equal(
      applyDateMath({
        baseDate: '2024-01-31T12:00:00.000Z',
        amount: 1,
        unit: 'months',
      }).result,
      '2024-02-29T12:00:00.000Z',
    )
    assert.equal(
      applyDateMath({
        baseDate: '2024-02-29T12:00:00.000Z',
        amount: 1,
        unit: 'years',
      }).result,
      '2025-02-28T12:00:00.000Z',
    )
  })

  it('calculates date differences', () => {
    const result = getDateDifference({
      from: '2026-05-05T00:00:00.000Z',
      to: '2026-05-12T00:00:00.000Z',
      unit: 'days',
    })

    assert.equal(result.value, 7)
  })
})
