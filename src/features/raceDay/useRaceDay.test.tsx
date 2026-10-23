import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { jstDayFromMs } from '../../lib/raceDay'
import { useRaceDay } from './useRaceDay'

describe('useRaceDay', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('天気を1回だけ取得して今日の馬場を反映する', async () => {
    const day = jstDayFromMs(Date.now())
    const fetchMock = vi.fn(async () => Response.json({
      ok: true, day, weather: { area: '東京', label: 'くもり', going: '稍重', reportDatetime: `${day}T17:00:00+09:00` },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useRaceDay(true))
    expect(result.current.weather).toBeNull()
    await waitFor(() => expect(result.current.weather?.going).toBe('稍重'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]).toEqual(['/api/race-day', expect.objectContaining({ credentials: 'omit' })])
  })

  it('無効なとき、または取得に失敗したときはレース名だけで続ける', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('offline') })
    vi.stubGlobal('fetch', fetchMock)
    const disabled = renderHook(() => useRaceDay(false))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(disabled.result.current.raceName).toEqual(expect.any(String))

    const failing = renderHook(() => useRaceDay(true))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(failing.result.current.weather).toBeNull()
  })
})
