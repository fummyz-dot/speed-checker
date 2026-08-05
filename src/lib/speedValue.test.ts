import { describe, expect, it } from 'vitest'
import {
  bandwidthBitsToMbps,
  formatFinalSpeedDisplay,
  formatLiveSpeedDisplay,
  MAX_DISPLAY_SPEED_MBPS,
  normalizeSpeedValue,
} from './speedValue'

describe('speedValue', () => {
  it('Cloudflareのbps値を一度だけMbpsへ変換する', () => {
    expect(bandwidthBitsToMbps(250_710_162)).toBeCloseTo(250.710162, 6)
  })

  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY, -1, '250']) (
    '不正値 %s を表示値として採用しない',
    (value) => {
      expect(normalizeSpeedValue(value)).toBeNull()
    },
  )

  it('表示可能な速度を10000 Mbpsへクランプする', () => {
    expect(normalizeSpeedValue(250_710_162)).toBe(MAX_DISPLAY_SPEED_MBPS)
    expect(bandwidthBitsToMbps(20_000_000_000)).toBe(MAX_DISPLAY_SPEED_MBPS)
  })

  it('ライブ中は6桁小数、確定後は読みやすい値にする', () => {
    expect(formatLiveSpeedDisplay(250.812394)).toBe('250.812394')
    expect(formatFinalSpeedDisplay(250.812394)).toBe('251')
    expect(formatFinalSpeedDisplay(42.84)).toBe('42.8')
  })
})
