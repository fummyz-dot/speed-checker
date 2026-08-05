import { describe, expect, it } from 'vitest'
import { createLiveSpeedFrame } from './useLiveSpeedDisplay'

describe('createLiveSpeedFrame', () => {
  it('整数部と小数第1位を保ち、小数第2位以降だけを回す', () => {
    expect(createLiveSpeedFrame(250.812394, 0.01)).toBeCloseTo(250.801, 6)
    expect(createLiveSpeedFrame(250.812394, 0.99)).toBeCloseTo(250.899, 6)
  })

  it('低速回線では値に合わせて回転桁の精度を細かくする', () => {
    expect(createLiveSpeedFrame(0.056, 0.5)).toBeCloseTo(0.055, 6)
    expect(createLiveSpeedFrame(0.0042, 0.5)).toBeCloseTo(0.00425, 6)
  })

  it('0と異常な巨大値でも表示範囲を外れない', () => {
    expect(createLiveSpeedFrame(0, 0.99)).toBe(0)
    expect(createLiveSpeedFrame(250_710_162, 0.99)).toBe(10_000)
  })
})
