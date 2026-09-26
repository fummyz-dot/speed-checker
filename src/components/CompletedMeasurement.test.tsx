import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadMeasurements, saveMeasurement } from '../lib/measurementStorage'
import type { SpeedMeasurementResult } from '../types/measurement'
import { CompletedMeasurement } from './CompletedMeasurement'

const measurement = (id: string): SpeedMeasurementResult => ({
  id,
  measuredAt: `2026-08-20T${id === 'current' ? '12' : '11'}:00:00.000Z`,
  downloadMbps: 100,
  uploadMbps: 50,
  pingMs: 20,
  downloadLoadedLatencyMs: 40,
  uploadLoadedLatencyMs: 50,
})

describe('CompletedMeasurement history', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => vi.restoreAllMocks())

  it('測定完了結果だけではNet Speed Runの起動導線を表示しない', () => {
    render(<CompletedMeasurement result={{ ...measurement('current'), jitterMs: 5 }} />)

    expect(screen.queryByText('NET SPEED RUN')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'GO TO RUN!' })).not.toBeInTheDocument()
  })

  it('有効な測定条件を最初に表示し、履歴への保存を確認できた場合だけ明示する', async () => {
    const result = { ...measurement('current'), conditionLabel: 'リビング 5GHz' }
    const { container } = render(<CompletedMeasurement result={result} />)

    expect(await screen.findByText('リビング 5GHz')).toBeVisible()
    expect(screen.getByText('履歴に保存')).toBeVisible()
    expect(container.querySelector('.completed-measurement')?.firstElementChild)
      .toHaveClass('completed-condition-label')
  })

  it('条件が未設定または無効な場合は測定条件metadataを表示しない', async () => {
    const { rerender } = render(<CompletedMeasurement result={measurement('current')} />)

    await screen.findByRole('heading', { name: '負荷による遅延増加' })
    expect(screen.queryByText('今回の測定条件')).not.toBeInTheDocument()

    rerender(<CompletedMeasurement result={{ ...measurement('next'), conditionLabel: 'あ'.repeat(25) }} />)
    expect(screen.queryByText('今回の測定条件')).not.toBeInTheDocument()
  })

  it('負荷による増加と用途別の判定を分けて説明し、対応するガイドへ案内する', () => {
    render(<CompletedMeasurement result={{
      ...measurement('current'), pingMs: 215,
      downloadLoadedLatencyMs: 220, uploadLoadedLatencyMs: 221,
    }} />)

    expect(screen.getByRole('heading', { name: '負荷による遅延増加' })).toBeVisible()
    expect(screen.getByText('良好')).toBeVisible()
    const gaming = screen.getByRole('heading', { name: 'オンラインゲーム' }).closest('article')
    const meeting = screen.getByRole('heading', { name: 'Web会議' }).closest('article')
    if (!(gaming instanceof HTMLElement) || !(meeting instanceof HTMLElement)) throw new Error('use-case card not found')
    expect(gaming).toHaveTextContent('厳しい可能性')
    expect(gaming).toHaveTextContent('Ping 215 ms が利用可能の参考目安（100 ms以下）を超えています。')
    expect(meeting).toHaveTextContent('厳しい可能性')
    expect(meeting).toHaveTextContent('Ping 215 ms が利用可能の参考目安（150 ms以下）を超えています。')
    expect(screen.getByRole('link', { name: '負荷時遅延の判定基準を見る' })).toHaveAttribute('href', '/loaded-latency/')
    expect(screen.getByRole('link', { name: 'ゲーム向けの判定基準を見る' })).toHaveAttribute('href', '/gaming/')
    expect(screen.getByRole('link', { name: 'Web会議の判定基準を見る' })).toHaveAttribute('href', '/video-call/')
  })

  it('再測定時に比較条件を1つ変える案内と入力欄への導線を表示する', () => {
    render(<CompletedMeasurement result={measurement('current')} />)

    expect(screen.getByRole('heading', { name: '次に試すこと' })).toBeVisible()
    expect(screen.getByText('同じ条件で2〜3回測った後、比較条件を1つ変えて再測定すると違いを比べやすくなります。例：Wi-Fi／有線、部屋、朝／夜。')).toBeVisible()
    expect(screen.getByRole('link', { name: '実測14回でPing・Jitterの変動を見る' })).toHaveAttribute('href', '/lab/ping-jitter-14-runs/')
    expect(screen.getByRole('link', { name: '比較条件を変えて再測定する' })).toHaveAttribute('href', '#measurement-condition-edit')
  })

  it('24文字の測定条件を表示できる', async () => {
    const conditionLabel = 'あ'.repeat(24)
    render(<CompletedMeasurement result={{ ...measurement('current'), conditionLabel }} />)

    expect(await screen.findByText(conditionLabel)).toBeVisible()
  })

  it('履歴保存に失敗した場合は条件を表示しても保存済みとは表示しない', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    render(<CompletedMeasurement result={{ ...measurement('current'), conditionLabel: '有線LAN' }} />)

    expect(await screen.findByText('有線LAN')).toBeVisible()
    expect(screen.queryByText('履歴に保存')).not.toBeInTheDocument()
  })

  it('前回比較の後、共有の前に履歴グラフを表示し、削除時に条件傾向も即座に消す', async () => {
    const previous = { ...measurement('previous'), conditionLabel: '有線LAN' }
    const current = { ...measurement('current'), conditionLabel: '有線LAN' }
    saveMeasurement(previous)
    const { container } = render(<CompletedMeasurement result={current} />)

    await screen.findByRole('heading', { name: '速度の推移' })
    expect(screen.getByRole('heading', { name: '測定条件ごとの傾向' })).toBeVisible()
    const panels = [...container.querySelectorAll('.completed-measurement > *')]
    expect(panels.findIndex((panel) => panel.classList.contains('measurement-history')))
      .toBeGreaterThan(panels.findIndex((panel) => panel.querySelector('#comparison-title')))
    expect(panels.findIndex((panel) => panel.classList.contains('measurement-history')))
      .toBeLessThan(panels.findIndex((panel) => panel.classList.contains('share-result')))

    fireEvent.click(screen.getByRole('button', { name: '履歴を削除' }))

    await waitFor(() => {
      expect(screen.getByText('あと1回以上測定すると、回線品質の変化を確認できます。')).toBeVisible()
    })
    expect(screen.queryByRole('heading', { name: '速度の推移' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '測定条件ごとの傾向' })).not.toBeInTheDocument()
    expect(screen.getAllByText('未測定')).toHaveLength(4)
    expect(loadMeasurements()).toEqual([])
  })
})
