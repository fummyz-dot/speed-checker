import { describe, expect, it } from 'vitest'
import {
  getFrontViewUploadRanks,
  getReferenceHorseDurations,
  getUserHorseJumpHeight,
  getUserHorseRunDuration,
  OGURI_REFERENCE_DOWNLOAD_MBPS,
  OGURI_REFERENCE_UPLOAD_MBPS,
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

  it('地方馬の基準を維持し、無敗の三冠馬は700 Mbps相当の走行時間にする', () => {
    const referenceDurations = getReferenceHorseDurations()

    expect(OGURI_REFERENCE_DOWNLOAD_MBPS).toBe(700)
    expect(referenceDurations.standard).toBe(13.5)
    expect(referenceDurations.fast).toBeCloseTo(10.03, 2)
    expect(referenceDurations.fast).toBe(getUserHorseRunDuration(OGURI_REFERENCE_DOWNLOAD_MBPS))
    expect(referenceDurations.fast).not.toBe(11.5)
    expect(getUserHorseRunDuration(699)).toBeGreaterThan(referenceDurations.fast)
    expect(getUserHorseRunDuration(700)).toBeCloseTo(referenceDurations.fast, 10)
    expect(getUserHorseRunDuration(701)).toBeLessThan(referenceDurations.fast)
  })

  it('動的championでも既存の走行時間・jump高の式をそのまま使い、defaultは旧値と一致する', () => {
    expect(getReferenceHorseDurations()).toEqual({
      standard: 13.5,
      fast: getUserHorseRunDuration(700),
    })
    expect(getReferenceHorseDurations(534.8)).toEqual({
      standard: 13.5,
      fast: getUserHorseRunDuration(534.8),
    })
    expect(getUserHorseJumpHeight(327.2)).toBeGreaterThan(getUserHorseJumpHeight(250))
    expect(getFrontViewUploadRanks(300, 327.2).fast.rank).toBe(1)
    expect(getFrontViewUploadRanks(300, 327.2).user.rank).toBe(2)
  })

  it.each([0, 0.1, 1, 10, 100, 1_000, 10_000, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    '上り %s Mbps を画面内のジャンプ高へ変換する',
    (speed) => {
      const height = getUserHorseJumpHeight(speed)
      expect(height).toBeGreaterThanOrEqual(22)
      expect(height).toBeLessThanOrEqual(100)
      expect(Number.isFinite(height)).toBe(true)
    },
  )

  it('速度が上がるほどユーザー馬のジャンプを高くする', () => {
    expect(getUserHorseJumpHeight(0)).toBeLessThan(getUserHorseJumpHeight(10))
    expect(getUserHorseJumpHeight(10)).toBeLessThan(getUserHorseJumpHeight(1_000))
  })

  it.each([
    [0, 22],
    [10, 55.3],
    [100, 86.1],
    [1_000, 100],
  ])('%s Mbpsを明確な高さ差のジャンプへ変換する', (speed, expected) => {
    expect(getUserHorseJumpHeight(speed)).toBeCloseTo(expected, 1)
  })

  it('front viewの表情を無敗の三冠馬250 Mbps基準のupload順位で決める', () => {
    expect(OGURI_REFERENCE_UPLOAD_MBPS).toBe(250)
    expect(getFrontViewUploadRanks(249)).toEqual({
      standard: { rank: 3, expression: 'disappointed' },
      user: { rank: 2, expression: 'satisfied' },
      fast: { rank: 1, expression: 'winner' },
    })
    expect(getFrontViewUploadRanks(250)).toEqual({
      standard: { rank: 3, expression: 'disappointed' },
      user: { rank: 2, expression: 'satisfied' },
      fast: { rank: 1, expression: 'winner' },
    })
    expect(getFrontViewUploadRanks(251)).toEqual({
      standard: { rank: 3, expression: 'disappointed' },
      user: { rank: 1, expression: 'winner' },
      fast: { rank: 2, expression: 'satisfied' },
    })
    expect(getFrontViewUploadRanks(1)).toEqual({
      standard: { rank: 2, expression: 'satisfied' },
      user: { rank: 3, expression: 'disappointed' },
      fast: { rank: 1, expression: 'winner' },
    })
  })

  it('無敗の三冠馬のjump基準は250 Mbps相当で、ユーザーの式をそのまま使う', () => {
    expect(getUserHorseJumpHeight(OGURI_REFERENCE_UPLOAD_MBPS)).toBeCloseTo(98.8, 1)
    expect(getUserHorseJumpHeight(OGURI_REFERENCE_UPLOAD_MBPS)).toBeGreaterThan(76)
    expect(getUserHorseJumpHeight(0)).toBe(22)
  })
})
