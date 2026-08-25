import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SpeedMeasurementResult } from '../types/measurement'
import { MeasurementHistoryTrend } from './MeasurementHistoryTrend'

const measurement = (id: string, overrides: Partial<SpeedMeasurementResult> = {}): SpeedMeasurementResult => ({
  id,
  measuredAt: `2026-08-${String(Number(id) + 1).padStart(2, '0')}T12:00:00.000Z`,
  downloadMbps: 100 + Number(id),
  uploadMbps: 20 + Number(id),
  pingMs: 10 + Number(id),
  downloadLoadedLatencyMs: 30 + Number(id),
  uploadLoadedLatencyMs: 40 + Number(id),
  timezoneOffsetMinutes: 0,
  ...overrides,
})

const timeBandCard = (label: string): HTMLElement => {
  const heading = screen.getByRole('heading', { name: label, level: 5 })
  const card = heading.closest('.time-band-card')
  if (!(card instanceof HTMLElement)) throw new Error(`${label} の時間帯カードが見つかりません`)
  return card
}

describe('MeasurementHistoryTrend', () => {
  it('履歴が1件の場合はグラフを表示せず、再測定案内を表示する', () => {
    render(<MeasurementHistoryTrend history={[measurement('1')]} />)

    expect(screen.getByRole('heading', { name: '測定履歴' })).toBeVisible()
    expect(screen.getByText('あと1回以上測定すると、回線品質の変化を確認できます。')).toBeVisible()
    expect(screen.queryByRole('img', { name: /速度の推移/ })).not.toBeInTheDocument()
  })

  it('履歴が2件以上なら速度と応答性の推移を表示する', () => {
    render(<MeasurementHistoryTrend history={[measurement('2'), measurement('1')]} />)

    expect(screen.getByRole('heading', { name: '速度の推移' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '応答性の推移' })).toBeVisible()
    expect(screen.getByRole('img', { name: /速度の推移/ })).toBeVisible()
    expect(screen.getByRole('img', { name: /応答性の推移/ })).toBeVisible()
  })

  it('13件以上でもTask 1の直近12件だけを描画する', () => {
    const history = Array.from({ length: 13 }, (_, index) => measurement(String(13 - index)))
    const { container } = render(<MeasurementHistoryTrend history={history} />)

    expect(container.querySelectorAll('[data-history-point="download"]')).toHaveLength(12)
    expect(container.querySelectorAll('[data-history-point="upload"]')).toHaveLength(12)
  })

  it('各系列で最新ポイントを明示する', () => {
    const { container } = render(<MeasurementHistoryTrend history={[measurement('2'), measurement('1')]} />)

    expect(container.querySelectorAll('[data-history-latest="true"]')).toHaveLength(4)
  })

  it('Loaded Latency増加が欠損したLegacy履歴を0として描画しない', () => {
    const { container } = render(<MeasurementHistoryTrend history={[
      measurement('2'),
      measurement('1', { downloadLoadedLatencyMs: undefined, uploadLoadedLatencyMs: undefined }),
    ]} />)

    expect(container.querySelectorAll('[data-history-point="loaded-latency"]')).toHaveLength(1)
    expect(within(timeBandCard('昼')).getByText('負荷時の増加')).toBeVisible()
  })

  it('朝・昼・夜・深夜を固定順で表示し、未測定の時間帯を示す', () => {
    render(<MeasurementHistoryTrend history={[
      measurement('1', { measuredAt: '2026-08-20T05:00:00.000Z' }),
    ]} />)

    expect(screen.getAllByRole('heading', { level: 5 }).map(({ textContent }) => textContent))
      .toEqual(['朝', '昼', '夜', '深夜'])
    expect(within(timeBandCard('昼')).getByText('未測定')).toBeVisible()
    expect(within(timeBandCard('昼')).getByText('この時間帯の測定結果はありません。')).toBeVisible()
    expect(within(timeBandCard('昼')).queryByRole('definition')).not.toBeInTheDocument()
    expect(within(timeBandCard('夜')).getByText('未測定')).toBeVisible()
    expect(within(timeBandCard('深夜')).getByText('未測定')).toBeVisible()
  })

  it('1〜2件の指標は参考値として表示する', () => {
    render(<MeasurementHistoryTrend history={[
      measurement('1', { measuredAt: '2026-08-20T05:00:00.000Z' }),
      measurement('2', { measuredAt: '2026-08-20T06:00:00.000Z' }),
    ]} />)

    const morning = within(timeBandCard('朝'))
    expect(morning.getAllByText('参考値')).toHaveLength(4)
    expect(morning.queryByText('2回・参考値')).not.toBeInTheDocument()
  })

  it('3件以上の有効サンプルは参考値扱いにしない', () => {
    render(<MeasurementHistoryTrend history={[
      measurement('1', { measuredAt: '2026-08-20T05:00:00.000Z' }),
      measurement('2', { measuredAt: '2026-08-20T06:00:00.000Z' }),
      measurement('3', { measuredAt: '2026-08-20T07:00:00.000Z' }),
    ]} />)

    const morning = within(timeBandCard('朝'))
    expect(morning.queryAllByText('3回')).toHaveLength(0)
    expect(morning.queryAllByRole('definition')).toHaveLength(4)
    expect(morning.queryByText(/参考値/)).not.toBeInTheDocument()
  })

  it('時間帯全体とLoaded Latencyのサンプル数が異なる場合、Loadedのみ参考値にする', () => {
    render(<MeasurementHistoryTrend history={[
      measurement('1', {
        measuredAt: '2026-08-20T05:00:00.000Z',
        downloadLoadedLatencyMs: 40,
        uploadLoadedLatencyMs: undefined,
      }),
      measurement('2', {
        measuredAt: '2026-08-20T06:00:00.000Z',
        downloadLoadedLatencyMs: undefined,
        uploadLoadedLatencyMs: undefined,
      }),
      measurement('3', {
        measuredAt: '2026-08-20T07:00:00.000Z',
        downloadLoadedLatencyMs: undefined,
        uploadLoadedLatencyMs: undefined,
      }),
    ]} />)

    const morning = timeBandCard('朝')
    expect(within(morning).getByText('3回測定')).toBeVisible()
    expect(within(morning).getByText('1回・参考値')).toBeVisible()
  })

  it('timezoneがないLegacy履歴を含む場合だけフォールバックの補足を表示する', () => {
    const { rerender } = render(<MeasurementHistoryTrend history={[
      measurement('1', { timezoneOffsetMinutes: undefined }),
    ]} />)

    expect(screen.getByText('一部の過去履歴は現在のタイムゾーンを基準に分類しています。')).toBeVisible()

    rerender(<MeasurementHistoryTrend history={[measurement('1')]} />)

    expect(screen.queryByText('一部の過去履歴は現在のタイムゾーンを基準に分類しています。')).not.toBeInTheDocument()
  })
})
