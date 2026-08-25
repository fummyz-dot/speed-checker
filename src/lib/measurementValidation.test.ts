import { describe, expect, it } from 'vitest'
import { EMPTY_METRICS } from '../types/speedTest'
import {
  createMeasurementResult,
  isValidMeasurementResult,
  MAX_CONDITION_LABEL_LENGTH,
  normalizeConditionLabel,
} from './measurementValidation'

describe('measurementValidation', () => {
  it('確定結果でもbpsを一度だけMbpsへ変換する', () => {
    const result = createMeasurementResult({
      ...EMPTY_METRICS,
      download: 250_710_162,
      upload: 80_450_000,
      latency: 12.4,
    }, new Date('2026-08-05T00:00:00.000Z'))

    expect(result?.downloadMbps).toBeCloseTo(250.710162, 6)
    expect(result?.uploadMbps).toBeCloseTo(80.45, 6)
    expect(result?.pingMs).toBe(12.4)
  })

  it('測定条件ラベルをtrimして新規測定結果へ保存する', () => {
    const result = createMeasurementResult({
      ...EMPTY_METRICS,
      download: 10_000_000,
      upload: 10_000_000,
    }, new Date('2026-08-05T00:00:00.000Z'), { conditionLabel: '  有線LAN  ' })

    expect(result?.conditionLabel).toBe('有線LAN')
  })

  it.each([
    ['trim済みの有効ラベル', '  リビング 5GHz  ', 'リビング 5GHz'],
    ['24文字のラベル', 'あ'.repeat(MAX_CONDITION_LABEL_LENGTH), 'あ'.repeat(MAX_CONDITION_LABEL_LENGTH)],
    ['空文字', '', null],
    ['空白のみ', '    ', null],
    ['null', null, null],
    ['undefined', undefined, null],
    ['25文字のラベル', 'あ'.repeat(MAX_CONDITION_LABEL_LENGTH + 1), null],
    ['number', 123, null],
    ['object', {}, null],
    ['array', [], null],
  ])('測定条件ラベルの%sを正規化する', (_description, value, expected) => {
    expect(normalizeConditionLabel(value)).toBe(expected)
  })

  it('異常な帯域値は確定結果でも10000 Mbpsへクランプする', () => {
    const result = createMeasurementResult({
      ...EMPTY_METRICS,
      download: 20_000_000_000,
      upload: 30_000_000_000,
    })

    expect(result?.downloadMbps).toBe(10_000)
    expect(result?.uploadMbps).toBe(10_000)
  })

  it('保存済み結果に表示上限を超える値を許可しない', () => {
    expect(isValidMeasurementResult({
      id: 'invalid-speed',
      measuredAt: '2026-08-05T00:00:00.000Z',
      downloadMbps: 250_710_162,
      uploadMbps: 80,
      pingMs: 12,
    })).toBe(false)
  })

  it('未trimまたは長すぎる測定条件ラベルを有効な保存結果として扱わない', () => {
    const baseResult = {
      id: 'invalid-condition-label',
      measuredAt: '2026-08-05T00:00:00.000Z',
      downloadMbps: 250,
      uploadMbps: 80,
      pingMs: 12,
    }

    expect(isValidMeasurementResult({ ...baseResult, conditionLabel: '  有線LAN  ' })).toBe(false)
    expect(isValidMeasurementResult({
      ...baseResult,
      conditionLabel: 'あ'.repeat(MAX_CONDITION_LABEL_LENGTH + 1),
    })).toBe(false)
  })
})
