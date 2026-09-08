import { describe, expect, it } from 'vitest'
import { mapScoreTenthsToRunTimeTenths } from './runTimeMapping'

describe('mapScoreTenthsToRunTimeTenths', () => {
  it.each([
    [0, 250],
    [5_003, 397],
    [8_499, 499],
    [8_500, 500],
    [8_501, 500],
    [10_000, 500],
    [16_243, 500],
    [20_608, 500],
  ])('maps scoreTenths %d to runTimeTenths %d', (scoreTenths, runTimeTenths) => {
    expect(mapScoreTenthsToRunTimeTenths(scoreTenths)).toBe(runTimeTenths)
  })

  it('rejects negative, non-integer, and non-finite input', () => {
    expect(() => mapScoreTenthsToRunTimeTenths(-1)).toThrow(RangeError)
    expect(() => mapScoreTenthsToRunTimeTenths(1.5)).toThrow(RangeError)
    expect(() => mapScoreTenthsToRunTimeTenths(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})
