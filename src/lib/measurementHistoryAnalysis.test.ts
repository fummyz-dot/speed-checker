import { describe, expect, it } from 'vitest'
import type { SpeedMeasurementResult } from '../types/measurement'
import {
  classifyTimeBand,
  getLoadedLatencyIncreaseMs,
  getRecentMeasurementTrend,
  median,
  RECENT_TREND_LIMIT,
  summarizeMeasurementsByTimeBand,
} from './measurementHistoryAnalysis'

const measurement = (
  id: string,
  measuredAt = '2026-08-20T00:00:00.000Z',
  overrides: Partial<SpeedMeasurementResult> = {},
): SpeedMeasurementResult => ({
  id,
  measuredAt,
  downloadMbps: 100,
  uploadMbps: 50,
  pingMs: 20,
  ...overrides,
})

describe('median', () => {
  it.each([
    [[10, 20, 30], 20],
    [[10, 20, 30, 40], 25],
    [[10], 10],
  ] as const)('%o の中央値を %s とする', (values, expected) => {
    expect(median(values)).toBe(expected)
  })

  it('入力配列を変更しない', () => {
    const values = [30, 10, 20]
    median(values)

    expect(values).toEqual([30, 10, 20])
  })
})

describe('getRecentMeasurementTrend', () => {
  it('最新12件を古い順へ並べ替えて返す', () => {
    const history = Array.from({ length: 30 }, (_, index) => measurement(String(29 - index)))

    const trend = getRecentMeasurementTrend(history)

    expect(trend).toHaveLength(RECENT_TREND_LIMIT)
    expect(trend.map(({ id }) => id)).toEqual(['18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29'])
  })

  it('12件未満をそのまま古い順へ返し、入力を変更しない', () => {
    const history = [measurement('newest'), measurement('middle'), measurement('oldest')]

    expect(getRecentMeasurementTrend(history).map(({ id }) => id)).toEqual(['oldest', 'middle', 'newest'])
    expect(history.map(({ id }) => id)).toEqual(['newest', 'middle', 'oldest'])
  })
})

describe('getLoadedLatencyIncreaseMs', () => {
  it('DownloadとUploadの増加量で大きい方を返す', () => {
    expect(getLoadedLatencyIncreaseMs(measurement('both', undefined, {
      pingMs: 20,
      downloadLoadedLatencyMs: 45,
      uploadLoadedLatencyMs: 70,
    }))).toBe(50)
  })

  it.each([
    ['Downloadのみ', { pingMs: 20, downloadLoadedLatencyMs: 45 }, 25],
    ['Uploadのみ', { pingMs: 20, uploadLoadedLatencyMs: 45 }, 25],
    ['両方欠損', { pingMs: 20 }, null],
    ['Idle欠損', { pingMs: null, downloadLoadedLatencyMs: 45 }, null],
    ['LoadedがIdle未満', { pingMs: 30, downloadLoadedLatencyMs: 20 }, 0],
    ['Legacy', { pingMs: 20 }, null],
  ] as const)('%sを安全に扱う', (_, overrides, expected) => {
    expect(getLoadedLatencyIncreaseMs(measurement('case', undefined, overrides))).toBe(expected)
  })
})

describe('classifyTimeBand', () => {
  it.each([
    ['2026-08-20T04:59:00.000Z', 0, 'lateNight'],
    ['2026-08-20T05:00:00.000Z', 0, 'morning'],
    ['2026-08-20T10:59:00.000Z', 0, 'morning'],
    ['2026-08-20T11:00:00.000Z', 0, 'daytime'],
    ['2026-08-20T16:59:00.000Z', 0, 'daytime'],
    ['2026-08-20T17:00:00.000Z', 0, 'evening'],
    ['2026-08-20T22:59:00.000Z', 0, 'evening'],
    ['2026-08-20T23:00:00.000Z', 0, 'lateNight'],
    ['2026-08-19T20:00:00.000Z', -540, 'morning'],
  ] as const)('%s をoffset %sで%sに分類する', (measuredAt, timezoneOffsetMinutes, expected) => {
    expect(classifyTimeBand(measuredAt, timezoneOffsetMinutes)).toBe(expected)
  })

  it.each([
    ['2026-08-20T12:00:00.000Z', Number.NaN],
    ['2026-08-20T12:00:00.000Z', Number.POSITIVE_INFINITY],
    ['2026-08-20T12:00:00.000Z', 841],
    ['invalid', 0],
  ] as const)('不正な入力でthrowせずnullを返す', (measuredAt, timezoneOffsetMinutes) => {
    expect(classifyTimeBand(measuredAt, timezoneOffsetMinutes)).toBeNull()
  })
})

describe('summarizeMeasurementsByTimeBand', () => {
  it('時間帯ごとの中央値とsample qualityを固定順で返す', () => {
    const summaries = summarizeMeasurementsByTimeBand([
      { measurement: measurement('night-1', '2026-08-20T17:00:00.000Z', { downloadMbps: 100 }), timezoneOffsetMinutes: 0 },
      { measurement: measurement('night-2', '2026-08-20T18:00:00.000Z', { downloadMbps: 200 }), timezoneOffsetMinutes: 0 },
      { measurement: measurement('night-3', '2026-08-20T19:00:00.000Z', { downloadMbps: 900 }), timezoneOffsetMinutes: 0 },
    ])
    const evening = summaries[2]

    expect(summaries.map(({ id }) => id)).toEqual(['morning', 'daytime', 'evening', 'lateNight'])
    expect(evening).toMatchObject({
      measurementCount: 3,
      downloadMbps: { median: 200, sampleCount: 3, quality: 'trend' },
    })
    expect(summaries[0].downloadMbps).toEqual({ median: null, sampleCount: 0, quality: 'none' })
  })

  it('1〜2件をreference、3件以上をtrendとする', () => {
    const summaries = summarizeMeasurementsByTimeBand([
      { measurement: measurement('morning-1', '2026-08-20T05:00:00.000Z'), timezoneOffsetMinutes: 0 },
      { measurement: measurement('morning-2', '2026-08-20T06:00:00.000Z'), timezoneOffsetMinutes: 0 },
      { measurement: measurement('day-1', '2026-08-20T11:00:00.000Z'), timezoneOffsetMinutes: 0 },
      { measurement: measurement('day-2', '2026-08-20T12:00:00.000Z'), timezoneOffsetMinutes: 0 },
      { measurement: measurement('day-3', '2026-08-20T13:00:00.000Z'), timezoneOffsetMinutes: 0 },
    ])

    expect(summaries[0].downloadMbps.quality).toBe('reference')
    expect(summaries[1].downloadMbps.quality).toBe('trend')
  })

  it('Legacy Loaded latencyでは指標別sampleCountを維持する', () => {
    const summaries = summarizeMeasurementsByTimeBand([
      { measurement: measurement('morning-1', '2026-08-20T05:00:00.000Z', { downloadLoadedLatencyMs: 40 }), timezoneOffsetMinutes: 0 },
      { measurement: measurement('morning-2', '2026-08-20T06:00:00.000Z'), timezoneOffsetMinutes: 0 },
      { measurement: measurement('morning-3', '2026-08-20T07:00:00.000Z'), timezoneOffsetMinutes: 0 },
    ])

    expect(summaries[0]).toMatchObject({
      measurementCount: 3,
      loadedLatencyIncreaseMs: { median: 20, sampleCount: 1, quality: 'reference' },
    })
  })
})
