import { describe, expect, it } from 'vitest'
import type { SpeedMeasurementResult } from '../types/measurement'
import {
  classifyTimeBand,
  getSampleQuality,
  getLoadedLatencyIncreaseMs,
  getRecentMeasurementTrend,
  median,
  RECENT_TREND_LIMIT,
  summarizeMeasurementsByCondition,
  summarizeMetric,
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

describe('sample quality', () => {
  it.each([
    [0, 'none'],
    [1, 'reference'],
    [2, 'reference'],
    [3, 'trend'],
  ] as const)('sampleCount %sを%sとして扱う', (sampleCount, quality) => {
    expect(getSampleQuality(sampleCount)).toBe(quality)
  })

  it('metricごとに有効なsampleだけを数える', () => {
    expect(summarizeMetric([10, Number.NaN, 30])).toEqual({
      median: 20,
      sampleCount: 2,
      quality: 'reference',
    })
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

describe('summarizeMeasurementsByCondition', () => {
  it('labelなし・null・不正labelを除外し、同じcanonical labelをまとめる', () => {
    const analysis = summarizeMeasurementsByCondition([
      measurement('living-new', '2026-08-24T12:00:00.000Z', { conditionLabel: '  リビング 5GHz  ', downloadMbps: 300 }),
      measurement('unlabeled', '2026-08-23T12:00:00.000Z'),
      measurement('living-old', '2026-08-22T12:00:00.000Z', { conditionLabel: 'リビング 5GHz', downloadMbps: 100 }),
      measurement('null', '2026-08-21T12:00:00.000Z', { conditionLabel: null }),
      measurement('invalid', '2026-08-20T12:00:00.000Z', { conditionLabel: 123 as unknown as string }),
      measurement('wired', '2026-08-19T12:00:00.000Z', { conditionLabel: '有線LAN' }),
    ])

    expect(analysis.labeledMeasurementCount).toBe(3)
    expect(analysis.summaries).toHaveLength(2)
    expect(analysis.summaries[0]).toMatchObject({
      conditionLabel: 'リビング 5GHz',
      totalMeasurements: 2,
      latestMeasuredAt: '2026-08-24T12:00:00.000Z',
      downloadMbps: { median: 200, sampleCount: 2, quality: 'reference' },
    })
    expect(analysis.summaries[1].conditionLabel).toBe('有線LAN')
  })

  it('最後に使われた日時の新しい順で最大5条件を返す', () => {
    const history = Array.from({ length: 6 }, (_, index) => measurement(
      String(index),
      `2026-08-${String(26 - index).padStart(2, '0')}T12:00:00.000Z`,
      { conditionLabel: `条件${index + 1}` },
    ))

    const analysis = summarizeMeasurementsByCondition(history)

    expect(analysis.summaries.map(({ conditionLabel }) => conditionLabel)).toEqual([
      '条件1', '条件2', '条件3', '条件4', '条件5',
    ])
    expect(analysis.totalConditionCount).toBe(6)
    expect(analysis.hasMoreConditions).toBe(true)
  })

  it('metric別のsampleCountを保ち、測定単位の混雑時増加を中央値にする', () => {
    const analysis = summarizeMeasurementsByCondition([
      measurement('1', '2026-08-24T12:00:00.000Z', {
        conditionLabel: '有線LAN', pingMs: 20, downloadLoadedLatencyMs: 40,
      }),
      measurement('2', '2026-08-23T12:00:00.000Z', {
        conditionLabel: '有線LAN', pingMs: 20, uploadLoadedLatencyMs: 80,
      }),
      measurement('3', '2026-08-22T12:00:00.000Z', {
        conditionLabel: '有線LAN', pingMs: null,
      }),
      measurement('4', '2026-08-21T12:00:00.000Z', {
        conditionLabel: '有線LAN', pingMs: 20,
      }),
      measurement('5', '2026-08-20T12:00:00.000Z', {
        conditionLabel: '有線LAN', pingMs: 20,
      }),
    ])

    expect(analysis.summaries[0]).toMatchObject({
      totalMeasurements: 5,
      downloadMbps: { sampleCount: 5, quality: 'trend' },
      uploadMbps: { sampleCount: 5, quality: 'trend' },
      pingMs: { sampleCount: 4, quality: 'trend' },
      loadedLatencyIncreaseMs: { median: 40, sampleCount: 2, quality: 'reference' },
    })
  })
})
