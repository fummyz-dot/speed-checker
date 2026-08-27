import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { instances, MockSpeedTest } = vi.hoisted(() => {
  const createdInstances: Array<{
    results: {
      getDownloadBandwidth: () => number
      getUploadBandwidth: () => number
      getUnloadedLatency: () => number
      getUnloadedJitter: () => number
      getDownLoadedLatency: () => number
      getUpLoadedLatency: () => number
    }
    pause: ReturnType<typeof vi.fn>
    play: ReturnType<typeof vi.fn>
    onPhaseChange?: (value: { measurement: { type: string } }) => void
    onResultsChange?: () => void
    onFinish?: (results: unknown) => void
    onError?: (message: unknown) => void
    config: unknown
  }> = []

  class FakeSpeedTest {
    results = {
      getDownloadBandwidth: () => 100_000_000,
      getUploadBandwidth: () => 50_000_000,
      getUnloadedLatency: () => 12,
      getUnloadedJitter: () => 1,
      getDownLoadedLatency: () => 24,
      getUpLoadedLatency: () => 30,
    }
    pause = vi.fn()
    play = vi.fn()
    onPhaseChange?: (value: { measurement: { type: string } }) => void
    onResultsChange?: () => void
    onFinish?: (results: unknown) => void
    onError?: (message: unknown) => void
    config: unknown

    constructor(config: unknown) {
      this.config = config
      createdInstances.push(this)
    }
  }

  return { instances: createdInstances, MockSpeedTest: FakeSpeedTest }
})

vi.mock('@cloudflare/speedtest', () => ({ default: MockSpeedTest }))

import { useSpeedTest } from './useSpeedTest'

const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState')
const originalWakeLock = Object.getOwnPropertyDescriptor(navigator, 'wakeLock')

const setVisibilityState = (visibilityState: 'hidden' | 'visible') => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: visibilityState,
  })
}

const restoreBrowserApis = () => {
  if (originalVisibilityState) {
    Object.defineProperty(document, 'visibilityState', originalVisibilityState)
  } else {
    Reflect.deleteProperty(document, 'visibilityState')
  }

  if (originalWakeLock) {
    Object.defineProperty(navigator, 'wakeLock', originalWakeLock)
  } else {
    Reflect.deleteProperty(navigator, 'wakeLock')
  }
}

describe('useSpeedTest', () => {
  afterEach(restoreBrowserApis)

  it('Cloudflareの完了時集計ログを無効にし、既存の測定設定を維持する', () => {
    const { result } = renderHook(() => useSpeedTest())

    act(() => {
      result.current.start()
    })

    expect(instances.at(-1)?.config).toEqual({
      autoStart: false,
      measurements: [
        { type: 'latency', numPackets: 20 },
        { type: 'download', bytes: 100_000, count: 5, bypassMinDuration: true },
        { type: 'download', bytes: 1_000_000, count: 6 },
        { type: 'download', bytes: 10_000_000, count: 4 },
        { type: 'download', bytes: 25_000_000, count: 2 },
        { type: 'upload', bytes: 100_000, count: 5, bypassMinDuration: true },
        { type: 'upload', bytes: 1_000_000, count: 6 },
        { type: 'upload', bytes: 10_000_000, count: 4 },
        { type: 'upload', bytes: 25_000_000, count: 2 },
      ],
      measureDownloadLoadedLatency: true,
      measureUploadLoadedLatency: true,
      logAimApiUrl: null,
    })
  })

  it('start時のconditionLabelをtrimして完了結果へ固定する', () => {
    const { result } = renderHook(() => useSpeedTest())

    act(() => {
      result.current.start({ conditionLabel: '  リビング 5GHz  ' })
    })
    const engine = instances.at(-1)
    expect(engine).toBeDefined()

    act(() => {
      engine?.onFinish?.(engine.results)
    })

    expect(result.current.completedResult?.conditionLabel).toBe('リビング 5GHz')
  })

  it('conditionLabelなしでも従来どおり測定完了できる', () => {
    const { result } = renderHook(() => useSpeedTest())

    act(() => {
      result.current.start()
    })
    const engine = instances.at(-1)
    act(() => {
      engine?.onFinish?.(engine.results)
    })

    expect(result.current.phase).toBe('complete')
    expect(result.current.completedResult?.conditionLabel).toBeNull()
  })

  it('測定エラーではconditionLabelを含む結果を保存しない', () => {
    const { result } = renderHook(() => useSpeedTest())

    act(() => {
      result.current.start({ conditionLabel: '有線LAN' })
    })
    const engine = instances.at(-1)
    act(() => {
      engine?.onError?.('network error')
    })

    expect(result.current.phase).toBe('error')
    expect(result.current.completedResult).toBeNull()
  })

  it('idle時にpageがhiddenになっても状態を変えない', () => {
    const instanceCount = instances.length
    const { result } = renderHook(() => useSpeedTest())
    setVisibilityState('hidden')

    act(() => document.dispatchEvent(new Event('visibilitychange')))

    expect(result.current).toMatchObject({ phase: 'idle', isRunning: false, error: null })
    expect(instances).toHaveLength(instanceCount)
  })

  it.each(['latency', 'download', 'upload'] as const)('%s中のhiddenはengineをpauseして結果を無効化する', (activePhase) => {
    const { result } = renderHook(() => useSpeedTest())
    act(() => result.current.start())
    const engine = instances.at(-1)

    if (activePhase !== 'latency') {
      act(() => engine?.onPhaseChange?.({ measurement: { type: activePhase } }))
    }
    setVisibilityState('hidden')
    act(() => document.dispatchEvent(new Event('visibilitychange')))

    expect(engine?.pause).toHaveBeenCalledTimes(1)
    expect(result.current).toMatchObject({
      phase: 'error',
      isRunning: false,
      completedResult: null,
      confirmedDownloadMbps: null,
    })
    expect(result.current.metrics).toEqual({
      download: null,
      upload: null,
      latency: null,
      jitter: null,
      downloadLoadedLatency: null,
      uploadLoadedLatency: null,
    })
    expect(result.current.error).toContain('測定中に画面を離れたため')
  })

  it('中断後に遅れて届くonFinishを無視し、pagehideの重複発火でも二重にpauseしない', () => {
    const { result } = renderHook(() => useSpeedTest())
    act(() => result.current.start())
    const engine = instances.at(-1)

    setVisibilityState('hidden')
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    act(() => window.dispatchEvent(new Event('pagehide')))
    act(() => engine?.onFinish?.(engine.results))

    expect(engine?.pause).toHaveBeenCalledTimes(1)
    expect(result.current).toMatchObject({ phase: 'error', completedResult: null })
  })

  it('complete後にhiddenになっても結果を保持し、visibleだけでは測定を再開しない', () => {
    const { result } = renderHook(() => useSpeedTest())
    act(() => result.current.start())
    const engine = instances.at(-1)
    act(() => engine?.onFinish?.(engine.results))
    const completedResult = result.current.completedResult

    setVisibilityState('hidden')
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    setVisibilityState('visible')
    act(() => document.dispatchEvent(new Event('visibilitychange')))

    expect(result.current).toMatchObject({ phase: 'complete', completedResult })
    expect(instances.at(-1)).toBe(engine)
  })

  it('中断後はもう一度測定からfresh runを開始できる', () => {
    const { result } = renderHook(() => useSpeedTest())
    act(() => result.current.start())
    const interruptedEngine = instances.at(-1)
    setVisibilityState('hidden')
    act(() => document.dispatchEvent(new Event('visibilitychange')))

    setVisibilityState('visible')
    act(() => result.current.start())

    expect(instances.at(-1)).not.toBe(interruptedEngine)
    expect(result.current).toMatchObject({ phase: 'latency', isRunning: true, error: null })
  })

  it('対応browserではWake Lockを要求し、完了時にreleaseする', async () => {
    const release = vi.fn().mockResolvedValue(undefined)
    const request = vi.fn().mockResolvedValue({ release })
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
    const { result } = renderHook(() => useSpeedTest())

    act(() => result.current.start())
    await act(async () => { await Promise.resolve() })
    const engine = instances.at(-1)
    act(() => engine?.onFinish?.(engine.results))
    await act(async () => { await Promise.resolve() })

    expect(request).toHaveBeenCalledWith('screen')
    expect(release).toHaveBeenCalledTimes(1)
  })

  it.each(['error', 'interruption'] as const)('Wake Lockは%s時にもreleaseする', async (outcome) => {
    const release = vi.fn().mockResolvedValue(undefined)
    const request = vi.fn().mockResolvedValue({ release })
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
    const { result } = renderHook(() => useSpeedTest())

    act(() => result.current.start())
    await act(async () => { await Promise.resolve() })
    const engine = instances.at(-1)
    if (outcome === 'error') {
      act(() => engine?.onError?.('network error'))
    } else {
      setVisibilityState('hidden')
      act(() => document.dispatchEvent(new Event('visibilitychange')))
    }
    await act(async () => { await Promise.resolve() })

    expect(release).toHaveBeenCalledTimes(1)
  })

  it('unmount時にもWake Lockをreleaseする', async () => {
    const release = vi.fn().mockResolvedValue(undefined)
    const request = vi.fn().mockResolvedValue({ release })
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
    const { result, unmount } = renderHook(() => useSpeedTest())

    act(() => result.current.start())
    await act(async () => { await Promise.resolve() })
    unmount()
    await act(async () => { await Promise.resolve() })

    expect(release).toHaveBeenCalledTimes(1)
  })

  it('Wake Lockの非対応・request失敗は測定を失敗させない', async () => {
    const request = vi.fn().mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
    const { result } = renderHook(() => useSpeedTest())

    act(() => result.current.start())
    await act(async () => { await Promise.resolve() })

    expect(result.current).toMatchObject({ phase: 'latency', isRunning: true, error: null })
  })

  it('Wake Lock非対応でも通常の測定を開始できる', () => {
    Reflect.deleteProperty(navigator, 'wakeLock')
    const { result } = renderHook(() => useSpeedTest())

    act(() => result.current.start())

    expect(result.current).toMatchObject({ phase: 'latency', isRunning: true, error: null })
  })
})
