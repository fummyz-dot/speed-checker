import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { useConnectionInfo } from './hooks/useConnectionInfo'
import { useSpeedTest } from './hooks/useSpeedTest'
import { EMPTY_METRICS } from './types/speedTest'
import { MEASUREMENT_STORAGE_KEY } from './lib/measurementStorage'

vi.mock('./hooks/useConnectionInfo')
vi.mock('./hooks/useSpeedTest')

const installMatchMedia = (initialMatches: boolean) => {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const mediaQueryList = {
    matches: initialMatches,
    media: '(max-width: 760px)',
    onchange: null,
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener)
    }),
    removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener)
    }),
    addListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener)
    }),
    removeListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener)
    }),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList

  vi.stubGlobal('matchMedia', vi.fn(() => mediaQueryList))

  return {
    setMatches: (matches: boolean) => {
      Object.assign(mediaQueryList, { matches })
      listeners.forEach((listener) => listener({ matches, media: mediaQueryList.media } as MediaQueryListEvent))
    },
    mediaQueryList,
  }
}

const getHeroControlOrder = (container: HTMLElement): string[] =>
  [...(container.querySelector('.hero__controls')?.children ?? [])].map((element) => {
    if (element.classList.contains('connection-info')) return 'connection'
    if (element.classList.contains('measurement-condition')) return 'condition'
    if (element.classList.contains('hero__measurement')) return 'measurement'
    return 'unknown'
  })

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('race-focus-lock')
    document.body.classList.remove('race-focus-lock')
    vi.mocked(useConnectionInfo).mockReturnValue({ state: { status: 'loading' }, retry: vi.fn() })
    vi.mocked(useSpeedTest).mockReturnValue({
      metrics: EMPTY_METRICS, phase: 'idle', isRunning: false, error: null, completedResult: null,
      confirmedDownloadMbps: null, start: vi.fn(),
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('h1を1件だけ正しい文言で表示する', () => {
    render(<App />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('インターネット速度を、シンプルに。')
    expect(document.getElementById('measurement-results')).toHaveAttribute('aria-labelledby', 'results-title')
  })

  it('測定前から開始ボタンとidle状態の馬コースを表示する', () => {
    const { container } = render(<App />)

    expect(screen.getByRole('button', { name: '測定開始' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '回線速度レース' })).toBeVisible()
    expect(container.querySelector('.horse-course')).toHaveAttribute('data-animation-state', 'idle')
  })

  it('desktopとmobileでhero controlsのDOM順を切り替え、viewport変更にも追従する', async () => {
    const matchMedia = installMatchMedia(false)
    const { container } = render(<App />)

    expect(getHeroControlOrder(container)).toEqual(['connection', 'condition', 'measurement'])

    act(() => matchMedia.setMatches(true))
    await waitFor(() => {
      expect(getHeroControlOrder(container)).toEqual(['condition', 'measurement', 'connection'])
    })

    act(() => matchMedia.setMatches(false))
    await waitFor(() => {
      expect(getHeroControlOrder(container)).toEqual(['connection', 'condition', 'measurement'])
    })
  })

  it('viewport変更で条件editorのdraftを失わず、listenerを解除する', async () => {
    const user = userEvent.setup()
    const matchMedia = installMatchMedia(false)
    const { container, unmount } = render(<App />)

    await user.click(screen.getByRole('button', { name: '設定' }))
    const input = screen.getByRole('textbox', { name: '条件名' })
    await user.type(input, 'リビング 5GHz')
    expect(screen.getByRole('button', { name: '測定開始' })).toBeDisabled()

    act(() => matchMedia.setMatches(true))
    await waitFor(() => {
      expect(getHeroControlOrder(container)).toEqual(['condition', 'measurement', 'connection'])
    })
    expect(screen.getByRole('textbox', { name: '条件名' })).toHaveValue('リビング 5GHz')
    expect(screen.getByRole('button', { name: '測定開始' })).toBeDisabled()

    unmount()
    expect(matchMedia.mediaQueryList.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('mobileでも確定した測定条件を渡してRace Focus Modeへ遷移し、editor中は開始できない', async () => {
    const user = userEvent.setup()
    const start = vi.fn()
    installMatchMedia(true)
    vi.mocked(useSpeedTest).mockReturnValue({
      metrics: EMPTY_METRICS, phase: 'idle', isRunning: false, error: null, completedResult: null,
      confirmedDownloadMbps: null, start,
    })

    render(<App />)
    await user.click(screen.getByRole('button', { name: '設定' }))
    await user.type(screen.getByRole('textbox', { name: '条件名' }), '有線LAN')
    expect(screen.getByRole('button', { name: '測定開始' })).toBeDisabled()
    expect(start).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'この条件を使う' }))
    await user.click(screen.getByRole('button', { name: '測定開始' }))

    expect(start).toHaveBeenCalledWith({ conditionLabel: '有線LAN' })
    expect(screen.getByRole('dialog', { name: '回線速度レース' })).toBeVisible()
  })

  it('測定開始と同時にレースへ集中し、背景操作とbody scrollをロックする', async () => {
    const user = userEvent.setup()
    const start = vi.fn()
    vi.mocked(useSpeedTest).mockReturnValue({
      metrics: EMPTY_METRICS, phase: 'idle', isRunning: false, error: null, completedResult: null,
      confirmedDownloadMbps: null, start,
    })

    render(<App />)
    await user.click(screen.getByRole('button', { name: '測定開始' }))

    expect(start).toHaveBeenCalledWith({ conditionLabel: null })
    const dialog = screen.getByRole('dialog', { name: '回線速度レース' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).not.toHaveAttribute('inert')
    expect(dialog).not.toHaveAttribute('aria-hidden')
    expect(dialog.closest('.hero')).not.toHaveAttribute('inert')
    expect(dialog.closest('.hero__dashboard')).not.toHaveAttribute('inert')
    expect(screen.getByRole('button', { name: '縮小' })).toHaveFocus()
    expect(document.documentElement).toHaveClass('race-focus-lock')
    expect(document.body).toHaveClass('race-focus-lock')
    expect(document.querySelector('.hero__controls')).toHaveAttribute('inert')

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '回線速度レース' })).not.toBeInTheDocument()
    })
    expect(start).toHaveBeenCalledTimes(1)
    expect(document.body).not.toHaveClass('race-focus-lock')
  })

  it('最新の正常保存履歴だけを次回の測定条件初期値にする', () => {
    window.localStorage.setItem(MEASUREMENT_STORAGE_KEY, JSON.stringify([
      {
        id: 'latest', measuredAt: '2026-08-21T00:00:00.000Z', downloadMbps: 100, uploadMbps: 50, pingMs: 10,
      },
      {
        id: 'older', measuredAt: '2026-08-20T00:00:00.000Z', downloadMbps: 100, uploadMbps: 50, pingMs: 10,
        conditionLabel: 'リビング 5GHz',
      },
    ]))

    render(<App />)
    expect(screen.getByText('未設定')).toBeVisible()
  })

  it('最新履歴の測定条件を測定開始時にuseSpeedTestへ渡す', async () => {
    const user = userEvent.setup()
    const start = vi.fn()
    window.localStorage.setItem(MEASUREMENT_STORAGE_KEY, JSON.stringify([{
      id: 'latest', measuredAt: '2026-08-21T00:00:00.000Z', downloadMbps: 100, uploadMbps: 50, pingMs: 10,
      conditionLabel: '  有線LAN  ',
    }]))
    vi.mocked(useSpeedTest).mockReturnValue({
      metrics: EMPTY_METRICS, phase: 'idle', isRunning: false, error: null, completedResult: null,
      confirmedDownloadMbps: null, start,
    })

    render(<App />)
    expect(screen.getByText('有線LAN')).toBeVisible()
    await user.click(screen.getByRole('button', { name: '測定開始' }))

    expect(start).toHaveBeenCalledWith({ conditionLabel: '有線LAN' })
  })

  it('条件のeditorを開いている間は測定開始できない', async () => {
    const user = userEvent.setup()
    const start = vi.fn()
    vi.mocked(useSpeedTest).mockReturnValue({
      metrics: EMPTY_METRICS, phase: 'idle', isRunning: false, error: null, completedResult: null,
      confirmedDownloadMbps: null, start,
    })

    render(<App />)
    await user.click(screen.getByRole('button', { name: '設定' }))

    expect(screen.getByRole('button', { name: '測定開始' })).toBeDisabled()
    expect(screen.getByText('測定条件を確定またはキャンセルしてください')).toBeVisible()
    expect(start).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: '回線速度レース' })).not.toBeInTheDocument()
  })

  it('手動縮小後はphaseが変わっても再拡大せず、新しい測定開始では再び集中する', async () => {
    const user = userEvent.setup()
    const start = vi.fn()
    let speedTest: ReturnType<typeof useSpeedTest> = {
      metrics: EMPTY_METRICS, phase: 'idle', isRunning: false, error: null, completedResult: null,
      confirmedDownloadMbps: null, start,
    }
    vi.mocked(useSpeedTest).mockImplementation(() => speedTest)

    const { rerender } = render(<App />)
    const startButton = screen.getByRole('button', { name: '測定開始' })
    await user.click(startButton)
    await user.click(screen.getByRole('button', { name: '縮小' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '回線速度レース' })).not.toBeInTheDocument()
    })
    await waitFor(() => expect(startButton).toHaveFocus())
    expect(document.documentElement).not.toHaveClass('race-focus-lock')
    expect(document.body).not.toHaveClass('race-focus-lock')

    speedTest = { ...speedTest, phase: 'upload', isRunning: true }
    rerender(<App />)
    expect(screen.queryByRole('dialog', { name: '回線速度レース' })).not.toBeInTheDocument()

    speedTest = { ...speedTest, phase: 'idle', isRunning: false }
    rerender(<App />)
    await user.click(screen.getByRole('button', { name: '測定開始' }))
    expect(screen.getByRole('dialog', { name: '回線速度レース' })).toBeVisible()
  })

  it('測定中に縮小した場合は、disabledな開始buttonの代わりに拡大buttonへfocusを戻す', async () => {
    const user = userEvent.setup()
    const start = vi.fn()
    let speedTest: ReturnType<typeof useSpeedTest> = {
      metrics: EMPTY_METRICS, phase: 'idle', isRunning: false, error: null, completedResult: null,
      confirmedDownloadMbps: null, start,
    }
    vi.mocked(useSpeedTest).mockImplementation(() => speedTest)

    const { rerender } = render(<App />)
    await user.click(screen.getByRole('button', { name: '測定開始' }))

    speedTest = { ...speedTest, phase: 'latency', isRunning: true }
    rerender(<App />)
    await user.click(screen.getByRole('button', { name: '縮小' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'レースを拡大' })).toHaveFocus())
    const expandButton = screen.getByRole('button', { name: 'レースを拡大' })

    await user.click(expandButton)
    await user.click(screen.getByRole('button', { name: '縮小' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'レースを拡大' })).toHaveFocus())
  })

  it('errorでは集中モードを解除して既存のerror表示へ戻る', async () => {
    const user = userEvent.setup()
    const start = vi.fn()
    let speedTest: ReturnType<typeof useSpeedTest> = {
      metrics: EMPTY_METRICS, phase: 'idle', isRunning: false, error: null, completedResult: null,
      confirmedDownloadMbps: null, start,
    }
    vi.mocked(useSpeedTest).mockImplementation(() => speedTest)

    const { rerender } = render(<App />)
    await user.click(screen.getByRole('button', { name: '測定開始' }))
    expect(screen.getByRole('dialog', { name: '回線速度レース' })).toBeVisible()

    speedTest = { ...speedTest, phase: 'error', error: '測定に失敗しました' }
    rerender(<App />)
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '回線速度レース' })).not.toBeInTheDocument()
      expect(document.body).not.toHaveClass('race-focus-lock')
    })
    expect(screen.getByRole('alert')).toHaveTextContent('測定に失敗しました')
  })

  it('unmount時にbody scroll lockを解除する', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)

    await user.click(screen.getByRole('button', { name: '測定開始' }))
    expect(document.body).toHaveClass('race-focus-lock')
    unmount()
    expect(document.body).not.toHaveClass('race-focus-lock')
  })

  it('測定中は測定条件を変更できない', () => {
    vi.mocked(useSpeedTest).mockReturnValue({
      metrics: EMPTY_METRICS, phase: 'download', isRunning: true, error: null, completedResult: null,
      confirmedDownloadMbps: null, start: vi.fn(),
    })

    render(<App />)
    expect(screen.getByRole('button', { name: '設定' })).toBeDisabled()
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
