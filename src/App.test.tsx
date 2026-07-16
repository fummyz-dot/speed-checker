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
      metrics: EMPTY_METRICS, phase: 'idle', isRunning: false, error: null, start: vi.fn(),
    })
  })

  it('h1を1件だけ正しい文言で表示する', () => {
    render(<App />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('インターネット速度を、シンプルに。')
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
      metrics: EMPTY_METRICS, phase: 'error', isRunning: false, error: '測定に失敗しました', start: vi.fn(),
    })
    render(<App />)
    expect(screen.getByRole('alert')).toHaveTextContent('測定に失敗しました')
  })
})
