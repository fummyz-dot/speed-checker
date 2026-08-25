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

  it('前回比較の後、共有の前に履歴グラフを表示し、削除時に即座に空状態へ戻す', async () => {
    const previous = measurement('previous')
    const current = measurement('current')
    saveMeasurement(previous)
    const { container } = render(<CompletedMeasurement result={current} />)

    await screen.findByRole('heading', { name: '速度の推移' })
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
    expect(screen.getAllByText('未測定')).toHaveLength(4)
    expect(loadMeasurements()).toEqual([])
  })
})
