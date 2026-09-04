import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SpeedMeasurementResult } from '../../types/measurement'
import { createRankingApiService } from './rankingService'

const measurement: SpeedMeasurementResult = {
  id: 'measurement-1',
  measuredAt: '2026-08-28T12:00:00.000Z',
  downloadMbps: 300,
  uploadMbps: 100,
  pingMs: 20,
  jitterMs: 5,
  downloadLoadedLatencyMs: 30,
  uploadLoadedLatencyMs: 40,
  conditionLabel: '有線LAN',
  timezoneOffsetMinutes: 540,
}

const contextResponse = {
  ok: true,
  rankingAvailable: true,
  rankingDay: '2026-08-28',
  ticket: 'ranking-ticket',
  ticketExpiresAtMs: 1_788_000_000_000,
  champion: {
    source: 'previous_day_winner',
    sourceDay: '2026-08-27',
    scoreTenths: 16834,
    downloadTenths: 5348,
    uploadTenths: 3272,
    qualifyingRuns: 2847,
  },
}

const submissionResponse = {
  ok: true,
  entry: { scoreTenths: 15247, rank: 128, tieCount: 1, totalRuns: 2847, topPercentTenths: 45 },
  top3: [
    { rank: 1, scoreTenths: 18432 },
    { rank: 2, scoreTenths: 17228 },
    { rank: 3, scoreTenths: 16804 },
  ],
  champion: {
    source: 'previous_day_winner',
    sourceDay: '2026-08-27',
    scoreTenths: 16834,
    downloadTenths: 5348,
    uploadTenths: 3272,
    qualifyingRuns: 2847,
  },
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('createRankingApiService', () => {
  it('gets context once with no-store and converts champion tenths to Mbps', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(contextResponse))
    vi.stubGlobal('fetch', fetch)

    const context = await createRankingApiService().getContext()

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/api/ranking/context', expect.objectContaining({
      method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store',
    }))
    expect(context.champion).toEqual({
      source: 'previous_day_winner', sourceDay: '2026-08-27', scoreTenths: 16834,
      downloadMbps: 534.8, uploadMbps: 327.2, qualifyingRuns: 2847,
    })
  })

  it('accepts a non-JP unavailable context as a valid response', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({
      ...contextResponse,
      rankingAvailable: false,
      ticket: null,
      ticketExpiresAtMs: null,
      unavailableReason: 'country_not_eligible',
      champion: { ...contextResponse.champion, source: 'fallback', sourceDay: null, scoreTenths: null },
    }))
    vi.stubGlobal('fetch', fetch)

    const context = await createRankingApiService().getContext()

    expect(context.rankingAvailable).toBe(false)
    expect(context.ticket).toBeNull()
    expect(context.unavailableReason).toBe('country_not_eligible')
  })

  it.each([
    ['invalid JSON', new Response('{')],
    ['invalid contract', jsonResponse({ ...contextResponse, champion: { ...contextResponse.champion, downloadTenths: NaN } })],
    ['non-2xx response', jsonResponse({ error: 'unavailable' }, 503)],
  ])('rejects a context %s', async (_caseName, response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    await expect(createRankingApiService().getContext()).rejects.toThrow()
  })

  it('aborts a context request after one second', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    vi.stubGlobal('fetch', fetch)

    const context = createRankingApiService().getContext()
    const expectation = expect(context).rejects.toThrow('Aborted')
    await vi.advanceTimersByTimeAsync(1000)

    await expectation
  })

  it('submits only the allowed measurement fields with the memory-only ticket', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(contextResponse))
      .mockResolvedValueOnce(jsonResponse(submissionResponse))
    vi.stubGlobal('fetch', fetch)
    const service = createRankingApiService()
    await service.getContext()

    const submission = await service.submitMeasurement(measurement, 'turnstile-token')
    const [, init] = fetch.mock.calls[1] as [string, RequestInit]

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][0]).toBe('/api/ranking/entries')
    expect(init).toMatchObject({
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    })
    expect(JSON.parse(init.body as string)).toEqual({
      ticket: 'ranking-ticket',
      turnstileToken: 'turnstile-token',
      measurement: { id: 'measurement-1', downloadMbps: 300, uploadMbps: 100, pingMs: 20, jitterMs: 5 },
    })
    expect(submission).toMatchObject({
      ok: true,
      entry: submissionResponse.entry,
      top3: submissionResponse.top3,
    })
    expect(submission.champion).toEqual({
      source: 'previous_day_winner', sourceDay: '2026-08-27', scoreTenths: 16834,
      downloadMbps: 534.8, uploadMbps: 327.2, qualifyingRuns: 2847,
    })
  })

  it('rejects before fetch when no eligible ticket has been obtained', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    await expect(createRankingApiService().submitMeasurement(measurement, 'turnstile-token')).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    ['API error', jsonResponse({ ok: false, code: 'TURNSTILE_FAILED' })],
    ['invalid response', jsonResponse({ ok: true, entry: {} })],
  ])('rejects a submission %s', async (_caseName, submission) => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(contextResponse))
      .mockResolvedValueOnce(submission)
    vi.stubGlobal('fetch', fetch)
    const service = createRankingApiService()
    await service.getContext()

    await expect(service.submitMeasurement(measurement, 'turnstile-token')).rejects.toThrow()
  })

  it('rejects a submission champion with the obsolete Mbps fields', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(contextResponse))
      .mockResolvedValueOnce(jsonResponse({
        ...submissionResponse,
        champion: {
          source: 'previous_day_winner', sourceDay: '2026-08-27', scoreTenths: 16834,
          downloadMbps: 534.8, uploadMbps: 327.2, qualifyingRuns: 2847,
        },
      }))
    vi.stubGlobal('fetch', fetch)
    const service = createRankingApiService()
    await service.getContext()

    await expect(service.submitMeasurement(measurement, 'turnstile-token')).rejects.toThrow()
  })
})
