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

    await screen.findByRole('heading', { name: '混雑時の応答性' })
    expect(screen.queryByText('今回の測定条件')).not.toBeInTheDocument()

    rerender(<CompletedMeasurement result={{ ...measurement('next'), conditionLabel: 'あ'.repeat(25) }} />)
    expect(screen.queryByText('今回の測定条件')).not.toBeInTheDocument()
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
