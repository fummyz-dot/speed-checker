import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { useConnectionInfo } from './hooks/useConnectionInfo'
import { useSpeedTest } from './hooks/useSpeedTest'
import { EMPTY_METRICS } from './types/speedTest'

vi.mock('./hooks/useConnectionInfo')
vi.mock('./hooks/useSpeedTest')

describe('App', () => {
  beforeEach(() => {
    vi.mocked(useConnectionInfo).mockReturnValue({ state: { status: 'loading' }, retry: vi.fn() })
    vi.mocked(useSpeedTest).mockReturnValue({
      metrics: EMPTY_METRICS, phase: 'idle', isRunning: false, error: null, completedResult: null,
      confirmedDownloadMbps: null, start: vi.fn(),
    })
  })

  it('h1を1件だけ正しい文言で表示する', () => {
    render(<App />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('インターネット速度を、シンプルに。')
  })

  it('測定前から開始ボタンとidle状態のランナーコースを表示する', () => {
    const { container } = render(<App />)

    expect(screen.getByRole('button', { name: '測定開始' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '回線速度レース' })).toBeVisible()
    expect(container.querySelector('.horse-course')).toHaveAttribute('data-animation-state', 'idle')
  })

  it('GitHubリンクを安全に新しいタブで開く', () => {
    render(<App />)
    const link = screen.getByRole('link', { name: 'GitHubでソースコードを見る' })
    expect(link).toHaveAttribute('href', 'https://github.com/fummyz-dot/speed-checker')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer noopener')
  })

  it('測定エラーをalertで表示する', () => {
    vi.mocked(useSpeedTest).mockReturnValue({
      metrics: EMPTY_METRICS, phase: 'error', isRunning: false, error: '測定に失敗しました', completedResult: null,
      confirmedDownloadMbps: null, start: vi.fn(),
    })
    render(<App />)
    expect(screen.getByRole('alert')).toHaveTextContent('測定に失敗しました')
  })

  it('測定中の左カードは静的な未確定表示にし、レース下の下りだけをライブ表示する', () => {
    vi.mocked(useSpeedTest).mockReturnValue({
      metrics: { ...EMPTY_METRICS, download: 250_812_394 },
      phase: 'download',
      isRunning: true,
      error: null,
      completedResult: null,
      confirmedDownloadMbps: null,
      start: vi.fn(),
    })

    const { container } = render(<App />)
    expect(container.querySelector('.speed-display__reading')).not.toHaveClass('speed-display__reading--live')
    expect(container.querySelector('.speed-display__reading strong')).toHaveTextContent('—')
    expect(container.querySelector('[data-speed-metric="download"]')).toHaveTextContent('250.812394 Mbps')
    expect(container.querySelector('[data-speed-metric="download"]')).toHaveAttribute('data-live', 'true')
    expect(container.querySelector('[data-speed-metric="upload"]')).toHaveAttribute('data-live', 'false')
    expect(container).not.toHaveTextContent('250812394.0 Mbps')
  })

  it('upload測定中は左カードと下りを確定値で固定し、レース下の上りだけをライブ表示する', () => {
    vi.mocked(useSpeedTest).mockReturnValue({
      metrics: { ...EMPTY_METRICS, download: 250_812_394, upload: 80_450_123 },
      phase: 'upload',
      isRunning: true,
      error: null,
      completedResult: null,
      confirmedDownloadMbps: 250.812394,
      start: vi.fn(),
    })

    const { container } = render(<App />)
    expect(container.querySelector('.speed-display__reading strong')).toHaveTextContent('251')
    expect(container.querySelector('[data-speed-metric="download"]')).toHaveTextContent('251 Mbps')
    expect(container.querySelector('[data-speed-metric="download"]')).toHaveAttribute('data-live', 'false')
    expect(container.querySelector('[data-speed-metric="upload"]')).toHaveTextContent('80.450123 Mbps')
    expect(container.querySelector('[data-speed-metric="upload"]')).toHaveAttribute('data-live', 'true')
  })

  it('測定完了後は正式Mbps値を読みやすく丸める', () => {
    const completedResult = {
      id: 'measurement-1',
      measuredAt: '2026-08-05T00:00:00.000Z',
      downloadMbps: 250.812394,
      uploadMbps: 80.45,
      pingMs: 12,
    }
    vi.mocked(useSpeedTest).mockReturnValue({
      metrics: { ...EMPTY_METRICS, download: 250_812_394, upload: 80_450_000 },
      phase: 'complete',
      isRunning: false,
      error: null,
      completedResult,
      confirmedDownloadMbps: completedResult.downloadMbps,
      start: vi.fn(),
    })

    const { container } = render(<App />)
    expect(container.querySelector('.speed-display__reading')).not.toHaveClass('speed-display__reading--live')
    expect(container.querySelector('.speed-display__reading strong')).toHaveTextContent('251')
    expect(container.querySelector('.horse-metrics')).toHaveTextContent('下り251 Mbps')
  })
})
