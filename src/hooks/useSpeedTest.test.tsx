import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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

    constructor() {
      createdInstances.push(this)
    }
  }

  return { instances: createdInstances, MockSpeedTest: FakeSpeedTest }
})

vi.mock('@cloudflare/speedtest', () => ({ default: MockSpeedTest }))

import { useSpeedTest } from './useSpeedTest'

describe('useSpeedTest', () => {
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
})
