import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_RACE_CHAMPION_REFERENCE } from '../../types/raceChampion'
import { createRankingApiService } from './rankingService'
import { useRankingPreview } from './useRankingPreview'

vi.mock('./rankingService', () => ({ createRankingApiService: vi.fn() }))

const champion = {
  source: 'previous_day_winner' as const,
  sourceDay: '2026-08-27', scoreTenths: 16834,
  downloadMbps: 534.8, uploadMbps: 327.2, qualifyingRuns: 2847,
}

afterEach(() => vi.clearAllMocks())

describe('useRankingPreview', () => {
  it('does not construct or call the ranking service while disabled', async () => {
    const { result } = renderHook(() => useRankingPreview(false))
    await act(async () => { await result.current.prepareMeasurement() })

    expect(createRankingApiService).not.toHaveBeenCalled()
    expect(result.current.context).toBeNull()
    expect(result.current.championReference).toEqual(DEFAULT_RACE_CHAMPION_REFERENCE)
  })

  it('fixes the successful context champion before the measurement starts', async () => {
    const getContext = vi.fn().mockResolvedValue({
      ok: true, rankingAvailable: true, rankingDay: '2026-08-28', ticket: 'preview-ticket', ticketExpiresAtMs: 1, champion,
    })
    vi.mocked(createRankingApiService).mockReturnValue({ getContext, submitMeasurement: vi.fn() })
    const { result } = renderHook(() => useRankingPreview(true))

    await act(async () => { await result.current.prepareMeasurement() })
    expect(getContext).toHaveBeenCalledTimes(1)
    expect(result.current.context?.rankingAvailable).toBe(true)
    expect(result.current.championReference).toEqual(champion)
  })

  it('falls back to the established 700 / 250 benchmark when context fails', async () => {
    vi.mocked(createRankingApiService).mockReturnValue({
      getContext: vi.fn().mockRejectedValue(new Error('unavailable')),
      submitMeasurement: vi.fn(),
    })
    const { result } = renderHook(() => useRankingPreview(true))

    await act(async () => { await result.current.prepareMeasurement() })
    expect(result.current.context).toBeNull()
    expect(result.current.championReference).toEqual(DEFAULT_RACE_CHAMPION_REFERENCE)
  })

  it('keeps a non-JP context out of ranking while still passing its champion to the race', async () => {
    vi.mocked(createRankingApiService).mockReturnValue({
      getContext: vi.fn().mockResolvedValue({
        ok: true, rankingAvailable: false, rankingDay: '2026-08-28', ticket: null, ticketExpiresAtMs: null,
        unavailableReason: 'country_not_eligible', champion,
      }),
      submitMeasurement: vi.fn(),
    })
    const { result } = renderHook(() => useRankingPreview(true))

    await act(async () => { await result.current.prepareMeasurement() })
    expect(result.current.context?.rankingAvailable).toBe(false)
    expect(result.current.championReference).toEqual(champion)
  })
})
