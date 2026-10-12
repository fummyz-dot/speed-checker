import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addDays, jstDay, loadRaceRecord, recordRankingStart } from '../../lib/raceRecord'
import { useRaceRecord } from './useRaceRecord'

const yesterday = () => addDays(jstDay(Date.now()), -1)

describe('useRaceRecord', () => {
  afterEach(() => {
    window.localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('前日の出走の確定順位をページ表示時に1回だけ取得して保存する', async () => {
    recordRankingStart({
      measurementId: 'm1', rankingDay: yesterday(), scoreTenths: 5000,
      atEntry: { rank: 2, tieCount: 1, totalRuns: 5 },
    })
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true, rankingDay: yesterday(), final: true, scoreTenths: 5000, rank: 4, tieCount: 1, totalRuns: 15,
    })))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useRaceRecord(true, null))
    await waitFor(() => expect(result.current.record.rankingStarts[0].final).not.toBeNull())

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(loadRaceRecord().bestFinal).toEqual({ rank: 4, tieCount: 1, totalRuns: 15, rankingDay: yesterday() })
  })

  it('ランキングが無効なら照会しない', () => {
    recordRankingStart({
      measurementId: 'm1', rankingDay: yesterday(), scoreTenths: 5000,
      atEntry: { rank: 2, tieCount: 1, totalRuns: 5 },
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderHook(() => useRaceRecord(false, null))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('照会に失敗しても記録は変えず、次回また照会できる', async () => {
    recordRankingStart({
      measurementId: 'm1', rankingDay: yesterday(), scoreTenths: 5000,
      atEntry: { rank: 2, tieCount: 1, totalRuns: 5 },
    })
    const fetchMock = vi.fn(async () => { throw new Error('offline') })
    vi.stubGlobal('fetch', fetchMock)
    renderHook(() => useRaceRecord(true, null))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(loadRaceRecord().rankingStarts).toHaveLength(1)
    expect(loadRaceRecord().rankingStarts[0].final).toBeNull()
  })
})
