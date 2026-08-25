import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SpeedMeasurementResult } from '../types/measurement'
import { MeasurementConditionTrend } from './MeasurementConditionTrend'

const measurement = (
  id: string,
  conditionLabel?: string | null,
  overrides: Partial<SpeedMeasurementResult> = {},
): SpeedMeasurementResult => ({
  id,
  measuredAt: `2026-08-${String(Number(id) + 1).padStart(2, '0')}T12:00:00.000Z`,
  downloadMbps: 100,
  uploadMbps: 50,
  pingMs: 20,
  ...overrides,
  ...(conditionLabel === undefined ? {} : { conditionLabel }),
})

describe('MeasurementConditionTrend', () => {
  it.each([
    [[] as SpeedMeasurementResult[]],
    [[measurement('1', '有線LAN')]],
  ])('ラベル付き履歴が0〜1件では表示しない', (history) => {
    render(<MeasurementConditionTrend history={history} />)

    expect(screen.queryByRole('heading', { name: '測定条件ごとの傾向' })).not.toBeInTheDocument()
  })

  it('2件のラベル付き履歴を表示し、1〜2件のmetricを参考値とする', () => {
    render(<MeasurementConditionTrend history={[
      measurement('2', 'リビング 5GHz', { downloadLoadedLatencyMs: 40 }),
      measurement('1', '有線LAN', { downloadLoadedLatencyMs: 40 }),
    ]} />)

    expect(screen.getByRole('heading', { name: '測定条件ごとの傾向' })).toBeVisible()
    expect(screen.getByText('同じ条件の結果を中央値でまとめます。時間帯や回線状況でも変動するため、条件だけが原因とは限りません。')).toBeVisible()
    expect(screen.getAllByText(/参考値/)).toHaveLength(8)
  })

  it('24文字のラベル、metric別sample表示、今回badgeを表示する', () => {
    const label = 'あ'.repeat(24)
    const current = measurement('2', label, {
      pingMs: null,
      downloadLoadedLatencyMs: undefined,
      uploadLoadedLatencyMs: undefined,
    })
    render(<MeasurementConditionTrend
      history={[current, measurement('1', label)]}
      currentResult={current}
    />)

    const row = screen.getByRole('heading', { name: label, level: 5 }).closest('.condition-trends__row')
    if (!(row instanceof HTMLElement)) throw new Error('condition row was not rendered')
    expect(within(row).getByText('今回')).toBeVisible()
    expect(within(row).getByText('n=1・参考値')).toBeVisible()
    expect(within(row).getByText('n=0・未測定')).toBeVisible()
  })

  it('3件以上の有効sampleを傾向として表示する', () => {
    render(<MeasurementConditionTrend history={[
      measurement('3', '有線LAN', { downloadLoadedLatencyMs: 40 }),
      measurement('2', '有線LAN', { downloadLoadedLatencyMs: 40 }),
      measurement('1', '有線LAN', { downloadLoadedLatencyMs: 40 }),
    ]} />)

    expect(screen.getAllByText(/n=3・傾向/)).toHaveLength(4)
  })

  it('6条件以上では直近5条件だけを表示する', () => {
    const history = Array.from({ length: 6 }, (_, index) => measurement(
      String(6 - index),
      `条件${6 - index}`,
    ))
    render(<MeasurementConditionTrend history={history} />)

    expect(screen.getByText('直近5条件を表示しています。')).toBeVisible()
    expect(screen.getAllByRole('heading', { level: 5 })).toHaveLength(5)
    expect(screen.queryByRole('heading', { name: '条件1', level: 5 })).not.toBeInTheDocument()
  })
})
