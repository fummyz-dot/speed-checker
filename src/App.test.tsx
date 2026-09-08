import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { useConnectionInfo } from './hooks/useConnectionInfo'
import { useSpeedTest } from './hooks/useSpeedTest'
import { createRankingApiService } from './features/ranking/rankingService'
import { EMPTY_METRICS } from './types/speedTest'
import { MEASUREMENT_STORAGE_KEY } from './lib/measurementStorage'
import {
  RUN_RETURN_CONTEXT_STORAGE_KEY,
  saveRunReturnContext,
} from './features/run/runReturnContext'

vi.mock('./hooks/useConnectionInfo')
vi.mock('./hooks/useSpeedTest')
vi.mock('./features/ranking/rankingService', () => ({ createRankingApiService: vi.fn() }))

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
    vi.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
    document.documentElement.classList.remove('race-focus-lock')
    document.body.classList.remove('race-focus-lock')
    vi.mocked(useConnectionInfo).mockReturnValue({ state: { status: 'loading' }, retry: vi.fn() })
    vi.mocked(useSpeedTest).mockReturnValue({
      metrics: EMPTY_METRICS, phase: 'idle', isRunning: false, error: null, completedResult: null,
      start: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('h1を1件だけ正しい文言で表示する', () => {
    const { container } = render(<App />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('インターネット速度を、シンプルに。')
    expect(document.getElementById('measurement-results')).toHaveAttribute('aria-labelledby', 'results-title')
    expect(container.querySelector('.hero__lead-mobile-break')).toBeInTheDocument()
  })

  it('測定前から開始ボタンとidle状態の馬コースを表示する', () => {
    const { container } = render(<App />)

    expect(screen.getByRole('button', { name: '測定開始' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '回線速度レース' })).toBeVisible()
    expect(container.querySelector('.horse-course')).toHaveAttribute('data-animation-state', 'idle')
    expect(screen.queryByRole('heading', { name: '本日の全国回線品質ランキング' })).not.toBeInTheDocument()
    expect(document.getElementById('ranking-results')).toBeNull()
    expect(screen.queryByLabelText('無敗の三冠馬の比較基準')).not.toBeInTheDocument()
  })

  it('ranking有効時はcontext後に動的championを固定し、ランキングcardは測定完了後だけ表示する', async () => {
    const user = userEvent.setup()
    vi.stubEnv('VITE_RANKING_ENABLED', 'true')
    const submitMeasurement = vi.fn().mockRejectedValue(new Error('stop after capture'))
    vi.stubGlobal('turnstile', {
      render: vi.fn((_container: HTMLElement, options: Record<string, unknown>) => {
        const callback = options.callback as (token: string) => void
        queueMicrotask(() => callback('turnstile-token'))
        return 'widget-id'
      }),
      execute: vi.fn(),
      remove: vi.fn(),
    })
    vi.mocked(createRankingApiService).mockReturnValue({
      getContext: vi.fn().mockResolvedValue({
        ok: true,
        rankingAvailable: true,
        rankingDay: '2026-08-28',
        ticket: 'ticket',
        ticketExpiresAtMs: 1,
        champion: {
          source: 'previous_day_winner', sourceDay: '2026-08-27', scoreTenths: 16834,
          downloadMbps: 534.8, uploadMbps: 327.2, qualifyingRuns: 2847,
        },
      }),
      getOverview: vi.fn().mockResolvedValue({
        ok: true,
        rankingDay: '2026-08-28',
        totalRuns: 12,
        top3: [
          { rank: 1, scoreTenths: 8503 },
          { rank: 2, scoreTenths: 7594 },
          { rank: 3, scoreTenths: 7110 },
        ],
      }),
      submitMeasurement,
    })
    const start = vi.fn()
    const completedResult = {
      id: 'ranking-measurement', measuredAt: '2026-08-28T12:00:00.000Z',
      downloadMbps: 510, uploadMbps: 51, pingMs: 20, jitterMs: 5,
    }
    let speedTest: ReturnType<typeof useSpeedTest> = {
      metrics: EMPTY_METRICS, phase: 'idle', isRunning: false, error: null, completedResult: null,
      start,
    }
    vi.mocked(useSpeedTest).mockImplementation(() => speedTest)

    const { rerender } = render(<App />)
    expect(screen.getByText('全国ランキング開催中！')).toBeVisible()
    expect(screen.getByText('あなたの回線は今日何位？ 測って確かめよう。')).toBeVisible()
    expect(document.querySelector('.hero__intro--with-ranking')).toBeInTheDocument()
    expect(document.querySelector('.hero__intro-copy')).toBeInTheDocument()
    expect(document.querySelectorAll('.hero-ranking-promo')).toHaveLength(1)
    expect(screen.queryByRole('heading', { name: '本日の全国回線品質ランキング' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '測定開始' }))

    await waitFor(() => expect(start).toHaveBeenCalledWith({ conditionLabel: null }))
    expect(screen.getByLabelText('無敗の三冠馬の比較基準')).toHaveTextContent('昨日の全国1位')
    expect(screen.getByLabelText('無敗の三冠馬の比較基準')).toHaveTextContent('535 Mbps')

    speedTest = {
      ...speedTest,
      phase: 'complete',
      completedResult,
    }
    rerender(<App />)
    const rankingResults = document.getElementById('ranking-results')
    const measurementResults = document.getElementById('measurement-results')

    expect(rankingResults).toBeInTheDocument()
    expect(rankingResults?.closest('.hero')).not.toBeNull()
    expect(within(rankingResults as HTMLElement).getByRole('heading', {
      name: '本日の全国回線品質ランキング', hidden: true,
    })).toBeInTheDocument()
    expect(rankingResults?.compareDocumentPosition(measurementResults as Node))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(within(measurementResults as HTMLElement).queryByRole('heading', {
      name: '本日の全国回線品質ランキング', hidden: true,
    })).not.toBeInTheDocument()
    expect(rankingResults).toHaveProperty('tabIndex', -1)
    expect(rankingResults).toHaveAttribute('aria-hidden', 'true')
    expect(rankingResults).toHaveAttribute('inert')
    expect(screen.getByRole('button', { name: '全国ランキングに参加して順位を見る', hidden: true })).toBeEnabled()
    expect(within(measurementResults as HTMLElement).queryByText('NET SPEED RUN'))
      .not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', {
      name: '全国ランキングに参加して順位を見る', hidden: true,
    }))
    await waitFor(() => {
      expect(submitMeasurement).toHaveBeenCalledWith(completedResult, 'turnstile-token')
    })
  })

  it('rankingを明示的に無効化した場合は完了後もcardを表示せずserviceを呼ばない', () => {
    vi.stubEnv('VITE_RANKING_ENABLED', 'false')
    const completedResult = {
      id: 'ranking-disabled-measurement', measuredAt: '2026-08-28T12:00:00.000Z',
      downloadMbps: 300, uploadMbps: 100, pingMs: 20, jitterMs: 5,
    }
    vi.mocked(useSpeedTest).mockReturnValue({
      metrics: EMPTY_METRICS, phase: 'complete', isRunning: false, error: null, completedResult,
      start: vi.fn(),
    })

    render(<App />)

    expect(createRankingApiService).not.toHaveBeenCalled()
    expect(document.getElementById('ranking-results')).toBeNull()
    expect(document.querySelector('.hero__intro--with-ranking')).not.toBeInTheDocument()
    expect(document.querySelector('.hero-ranking-promo')).not.toBeInTheDocument()
    expect(screen.queryByText('全国ランキング開催中！')).not.toBeInTheDocument()
    expect(screen.queryByText('NET SPEED RUN')).not.toBeInTheDocument()
  })

  it('development/testのdefaultではranking serviceを呼ばない', async () => {
    const user = userEvent.setup()
    const start = vi.fn()
    vi.mocked(useSpeedTest).mockReturnValue({
      metrics: EMPTY_METRICS, phase: 'idle', isRunning: false, error: null, completedResult: null,
      start,
    })

    render(<App />)
    await user.click(screen.getByRole('button', { name: '測定開始' }))

    expect(start).toHaveBeenCalledWith({ conditionLabel: null })
    expect(createRankingApiService).not.toHaveBeenCalled()
  })

  it('Runの元measurementを履歴から復元し、再送信せず詳細へ移動する', async () => {
    vi.stubEnv('VITE_RANKING_ENABLED', 'true')
    const restoredResult = {
      id: 'run-source',
      measuredAt: '2026-09-09T00:00:00.000Z',
      downloadMbps: 321.4,
      uploadMbps: 87.6,
      pingMs: 12.3,
      jitterMs: 2.1,
      downloadLoadedLatencyMs: 34.5,
      uploadLoadedLatencyMs: 45.6,
    }
    window.localStorage.setItem(MEASUREMENT_STORAGE_KEY, JSON.stringify([restoredResult]))
    saveRunReturnContext(restoredResult.id)
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    const start = vi.fn()
    vi.mocked(useSpeedTest).mockReturnValue({
      metrics: EMPTY_METRICS, phase: 'idle', isRunning: false, error: null, completedResult: null,
      start,
    })

    const { container } = render(<App />)

    expect(await screen.findByText('Runで使用した測定結果を表示しています。')).toBeVisible()
    expect(container.querySelector('.speed-display__reading strong')).toHaveTextContent('321')
    const details = document.getElementById('measurement-results') as HTMLElement
    expect(within(details).getByText('87.6')).toBeVisible()
    expect(within(details).getByText('12')).toBeVisible()
    expect(within(details).getByText('2.1')).toBeVisible()
    expect(within(details).getByText('35')).toBeVisible()
    expect(within(details).getByText('46')).toBeVisible()
    expect(screen.getByRole('button', { name: 'もう一度測定' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: '本日の全国回線品質ランキング' })).not.toBeInTheDocument()
    expect(createRankingApiService).not.toHaveBeenCalled()
    expect(start).not.toHaveBeenCalled()
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
    expect(document.getElementById('results-title')).toHaveFocus()
    expect(window.sessionStorage.getItem(RUN_RETURN_CONTEXT_STORAGE_KEY)).toBeNull()
    expect(JSON.parse(window.localStorage.getItem(MEASUREMENT_STORAGE_KEY) ?? '[]')).toEqual([restoredResult])
  })

  it('Return Contextと一致する履歴がなければ通常トップへ戻る', async () => {
    window.localStorage.setItem(MEASUREMENT_STORAGE_KEY, JSON.stringify([{
      id: 'other', measuredAt: '2026-09-08T00:00:00.000Z',
      downloadMbps: 100, uploadMbps: 50, pingMs: 20,
    }]))
    saveRunReturnContext('missing')

    const { container } = render(<App />)

    await waitFor(() => {
      expect(window.sessionStorage.getItem(RUN_RETURN_CONTEXT_STORAGE_KEY)).toBeNull()
    })
    expect(screen.getByRole('button', { name: '測定開始' })).toBeVisible()
    expect(container.querySelector('.speed-display__reading strong')).toHaveTextContent('—')
    expect(screen.queryByText('Runで使用した測定結果を表示しています。')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('復元結果からもう一度測定すると古い表示を解除して新規測定を開始する', async () => {
    const user = userEvent.setup()
    const restoredResult = {
      id: 'run-source', measuredAt: '2026-09-09T00:00:00.000Z',
      downloadMbps: 321.4, uploadMbps: 87.6, pingMs: 12.3,
    }
    window.localStorage.setItem(MEASUREMENT_STORAGE_KEY, JSON.stringify([restoredResult]))
    saveRunReturnContext(restoredResult.id)
    HTMLElement.prototype.scrollIntoView = vi.fn()
    const start = vi.fn()
    vi.mocked(useSpeedTest).mockReturnValue({
      metrics: EMPTY_METRICS, phase: 'idle', isRunning: false, error: null, completedResult: null,
      start,
    })

    const { container } = render(<App />)
    await screen.findByText('Runで使用した測定結果を表示しています。')
    await user.click(screen.getByRole('button', { name: 'もう一度測定' }))

    expect(start).toHaveBeenCalledWith({ conditionLabel: null })
    expect(screen.queryByText('Runで使用した測定結果を表示しています。')).not.toBeInTheDocument()
    expect(container.querySelector('.speed-display__reading strong')).toHaveTextContent('—')
    expect(screen.queryByText('今回の測定条件')).not.toBeInTheDocument()
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
      start,
    })

    render(<App />)
    await user.click(screen.getByRole('button', { name: '設定' }))
    await user.type(screen.getByRole('textbox', { name: '条件名' }), '有線LAN')
    expect(screen.getByRole('button', { name: '測定開始' })).toBeDisabled()
    expect(start).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'この条件を使う' }))
    await user.click(screen.getByRole('button', { name: '測定開始' }))

    expect(start).toHaveBeenCalledWith({ conditionLabel: '有線LAN' })
    const dialog = screen.getByRole('dialog', { name: '回線速度レース' })
    expect(dialog).toBeVisible()
    expect(screen.queryByRole('button', { name: '縮小' })).not.toBeInTheDocument()
    expect(dialog).toHaveFocus()
  })

  it('測定開始と同時にレースへ集中し、背景操作とbody scrollをロックする', async () => {
    const user = userEvent.setup()
    const start = vi.fn()
    const staticContent = document.createElement('div')
    staticContent.id = 'home-static-content'
    document.body.append(staticContent)
    vi.mocked(useSpeedTest).mockReturnValue({
      metrics: EMPTY_METRICS, phase: 'idle', isRunning: false, error: null, completedResult: null,
      start,
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
    expect(staticContent).toHaveAttribute('aria-hidden', 'true')
    expect(staticContent).toHaveAttribute('inert')

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '回線速度レース' })).not.toBeInTheDocument()
    })
    expect(start).toHaveBeenCalledTimes(1)
    expect(document.body).not.toHaveClass('race-focus-lock')
    expect(staticContent).not.toHaveAttribute('aria-hidden')
    expect(staticContent).not.toHaveAttribute('inert')
    staticContent.remove()
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
      start,
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
      start,
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
      start,
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
      start,
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

  it('mobileでは縮小後に存在しない拡大buttonをfocus fallbackにしない', async () => {
    const user = userEvent.setup()
    const start = vi.fn()
    installMatchMedia(true)
    let speedTest: ReturnType<typeof useSpeedTest> = {
      metrics: EMPTY_METRICS, phase: 'idle', isRunning: false, error: null, completedResult: null,
      start,
    }
    vi.mocked(useSpeedTest).mockImplementation(() => speedTest)

    const { rerender } = render(<App />)
    await user.click(screen.getByRole('button', { name: '測定開始' }))

    speedTest = { ...speedTest, phase: 'latency', isRunning: true }
    rerender(<App />)
    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '回線速度レース' })).not.toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'レースを拡大' })).not.toBeInTheDocument()
  })

  it('errorでは集中モードを解除して既存のerror表示へ戻る', async () => {
    const user = userEvent.setup()
    const start = vi.fn()
    let speedTest: ReturnType<typeof useSpeedTest> = {
      metrics: EMPTY_METRICS, phase: 'idle', isRunning: false, error: null, completedResult: null,
      start,
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
      start: vi.fn(),
    })

    render(<App />)
    expect(screen.getByRole('button', { name: '設定' })).toBeDisabled()
  })

  it('測定エラーをalertで表示する', () => {
    vi.mocked(useSpeedTest).mockReturnValue({
      metrics: EMPTY_METRICS, phase: 'error', isRunning: false, error: '測定に失敗しました', completedResult: null,
      start: vi.fn(),
    })
    render(<App />)
    expect(screen.getByRole('alert')).toHaveTextContent('測定に失敗しました')
  })

  it('測定中の左カードは静的な未確定表示にし、レース下の下りだけをライブ表示する', () => {
    vi.mocked(useSpeedTest).mockReturnValue({
      metrics: { ...EMPTY_METRICS, download: 500_000_000 },
      phase: 'download',
      isRunning: true,
      error: null,
      completedResult: null,
      start: vi.fn(),
    })

    const { container } = render(<App />)
    expect(container.querySelector('.speed-display__reading')).not.toHaveClass('speed-display__reading--live')
    expect(container.querySelector('.speed-display__reading strong')).toHaveTextContent('—')
    expect(container.querySelector('[data-speed-metric="download"]')).toHaveTextContent('500.000000 Mbps')
    expect(container.querySelector('[data-speed-metric="download"]')).toHaveAttribute('data-live', 'true')
    expect(container.querySelector('[data-speed-metric="upload"]')).toHaveAttribute('data-live', 'false')
    expect(container).not.toHaveTextContent('500000000.0 Mbps')
  })

  it('upload測定中もレース内の下りと上りをlive表示し、トップは未確定のままにする', () => {
    vi.mocked(useSpeedTest).mockReturnValue({
      metrics: { ...EMPTY_METRICS, download: 500_000_000, upload: 50_000_000 },
      phase: 'upload',
      isRunning: true,
      error: null,
      completedResult: null,
      start: vi.fn(),
    })

    const { container } = render(<App />)
    expect(container.querySelector('.speed-display__reading strong')).toHaveTextContent('—')
    expect(container.querySelector('[data-speed-metric="download"]')).toHaveTextContent('500.000000 Mbps')
    expect(container.querySelector('[data-speed-metric="download"]')).not.toHaveTextContent('— Mbps')
    expect(container.querySelector('[data-speed-metric="download"]')).toHaveAttribute('data-live', 'true')
    expect(container.querySelector('[data-speed-metric="upload"]')).toHaveTextContent('50.000000 Mbps')
    expect(container.querySelector('[data-speed-metric="upload"]')).toHaveAttribute('data-live', 'true')
    expect(container.querySelector('.horse-course')).toHaveAttribute('data-animation-state', 'warmingUp')
    expect(container.querySelectorAll('.race-runner--racing')).toHaveLength(0)
  })

  it('Upload中はprovisional 500をlive表示し、完了表示・レース・履歴をfinal 510に統一する', async () => {
    const completedResult = {
      id: 'measurement-1',
      measuredAt: '2026-08-05T00:00:00.000Z',
      downloadMbps: 510,
      uploadMbps: 51,
      pingMs: 12,
    }
    let speedTest: ReturnType<typeof useSpeedTest> = {
      metrics: { ...EMPTY_METRICS, download: 500_000_000, upload: 50_000_000 },
      phase: 'upload',
      isRunning: true,
      error: null,
      completedResult: null,
      start: vi.fn(),
    }
    vi.mocked(useSpeedTest).mockImplementation(() => speedTest)

    const { container, rerender } = render(<App />)
    expect(container.querySelector('.speed-display__reading strong')).toHaveTextContent('—')
    expect(container.querySelector('[data-speed-metric="download"]')).toHaveTextContent('500.000000 Mbps')
    expect(container.querySelector('[data-speed-metric="download"]')).toHaveAttribute('data-live', 'true')
    expect(container.querySelector('.horse-course')).toHaveAttribute('data-animation-state', 'warmingUp')
    expect(container.querySelectorAll('.race-runner--racing')).toHaveLength(0)

    speedTest = {
      ...speedTest,
      metrics: { ...speedTest.metrics, download: 510_000_000, upload: 51_000_000 },
      phase: 'complete',
      isRunning: false,
      completedResult,
    }
    rerender(<App />)

    expect(container.querySelector('.speed-display__reading')).not.toHaveClass('speed-display__reading--live')
    expect(container.querySelector('.speed-display__reading strong')).toHaveTextContent('510')
    expect(container.querySelector('.horse-metrics')).toHaveTextContent('下り510 Mbps')
    expect(container.querySelector('[data-speed-metric="download"]')).toHaveAttribute('data-live', 'false')
    expect(container.querySelector('[data-speed-metric="upload"]')).toHaveTextContent('51.0 Mbps')
    expect(container.querySelector('[data-speed-metric="upload"]')).toHaveAttribute('data-live', 'false')
    await waitFor(() => {
      const history = JSON.parse(window.localStorage.getItem(MEASUREMENT_STORAGE_KEY) ?? '[]') as Array<{ downloadMbps: number }>
      expect(history[0]?.downloadMbps).toBe(510)
    })
  })
})
