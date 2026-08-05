import { describe, expect, it } from 'vitest'
import { EMPTY_METRICS } from '../types/speedTest'
import {
  createMeasurementResult,
  isValidMeasurementResult,
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
})
