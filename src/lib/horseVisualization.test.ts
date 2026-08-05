import { describe, expect, it } from 'vitest'
import {
  getReferenceHorseDurations,
  getUserHorseJumpHeight,
  getUserHorseRunDuration,
} from './horseVisualization'

describe('horseVisualization', () => {
  it.each([0, 0.1, 1, 10, 100, 1_000, 10_000, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    '下り %s Mbps を9.5〜18秒の範囲へ変換する',
    (speed) => {
      const duration = getUserHorseRunDuration(speed)
      expect(duration).toBeGreaterThanOrEqual(9.5)
      expect(duration).toBeLessThanOrEqual(18)
      expect(Number.isFinite(duration)).toBe(true)
    },
  )

  it.each([
    [1, 18],
    [10, 15.2],
    [100, 12.4],
    [300, 11.06],
    [1_000, 9.6],
    [10_000, 9.5],
  ])('%s Mbpsを目で追える約%s秒へ変換する', (speed, expected) => {
    expect(getUserHorseRunDuration(speed)).toBeCloseTo(expected, 1)
  })

  it('速度が上がるほどユーザー馬の走行時間を短くする', () => {
    expect(getUserHorseRunDuration(0)).toBeGreaterThan(getUserHorseRunDuration(10))
    expect(getUserHorseRunDuration(10)).toBeGreaterThan(getUserHorseRunDuration(1_000))
  })

  it('標準馬と高速馬に比較しやすい固定走行時間を返す', () => {
    expect(getReferenceHorseDurations()).toEqual({ standard: 13.5, fast: 11.5 })
  })

  it.each([0, 0.1, 1, 10, 100, 1_000, 10_000, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    '上り %s Mbps を画面内のジャンプ高へ変換する',
    (speed) => {
      const height = getUserHorseJumpHeight(speed)
      expect(height).toBeGreaterThanOrEqual(10)
      expect(height).toBeLessThanOrEqual(52)
      expect(Number.isFinite(height)).toBe(true)
    },
  )

  it('速度が上がるほどユーザー馬のジャンプを高くする', () => {
    expect(getUserHorseJumpHeight(0)).toBeLessThan(getUserHorseJumpHeight(10))
    expect(getUserHorseJumpHeight(10)).toBeLessThan(getUserHorseJumpHeight(1_000))
  })
})
