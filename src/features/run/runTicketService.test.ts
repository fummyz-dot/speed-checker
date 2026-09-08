import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SpeedMeasurementResult } from '../../types/measurement'
import { issueRunTicket, RunTicketIssueError } from './runTicketService'

const measurement: SpeedMeasurementResult = {
  id: 'measurement-1',
  measuredAt: '2026-09-08T12:00:00.000Z',
  downloadMbps: 300,
  uploadMbps: 100,
  pingMs: 20,
  jitterMs: 5,
  downloadLoadedLatencyMs: 30,
  uploadLoadedLatencyMs: 40,
  timezoneOffsetMinutes: 540,
  conditionLabel: '有線LAN',
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('issueRunTicket', () => {
  it('posts only the allow-listed measurement fields and validates an exact success response', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({
      ok: true, ticket: 'run-ticket', expiresAtMs: 1_800_000_000_000,
    }))
    vi.stubGlobal('fetch', fetch)

    await expect(issueRunTicket(measurement)).resolves.toEqual({
      ok: true, ticket: 'run-ticket', expiresAtMs: 1_800_000_000_000,
    })
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/run-ticket')
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    })
    expect(JSON.parse(init.body as string)).toEqual({
      measurement: {
        id: 'measurement-1', downloadMbps: 300, uploadMbps: 100, pingMs: 20, jitterMs: 5,
      },
    })
    expect(init.body).not.toContain('conditionLabel')
    expect(init.body).not.toContain('measuredAt')
    expect(init.body).not.toContain('LoadedLatency')
    expect(init.body).not.toContain('timezoneOffsetMinutes')
  })

  it.each([
    ['missing Ping', { ...measurement, pingMs: null }],
    ['missing Jitter', { ...measurement, jitterMs: null }],
    ['undefined Jitter', { ...measurement, jitterMs: undefined }],
  ])('rejects %s before calling the API', async (_caseName, ineligibleMeasurement) => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    await expect(issueRunTicket(ineligibleMeasurement)).rejects.toMatchObject({
      code: 'MEASUREMENT_NOT_ELIGIBLE',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    ['extra success field', { ok: true, ticket: 'ticket', expiresAtMs: 1_800_000_000_000, score: 1 }],
    ['empty ticket', { ok: true, ticket: '', expiresAtMs: 1_800_000_000_000 }],
    ['invalid expiry', { ok: true, ticket: 'ticket', expiresAtMs: 1.5 }],
    ['unknown error', { ok: false, code: 'SOMETHING_ELSE' }],
  ])('rejects malformed response: %s', async (_caseName, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body)))
    await expect(issueRunTicket(measurement)).rejects.toMatchObject({ code: 'UNKNOWN' })
  })

  it.each([
    ['MEASUREMENT_NOT_ELIGIBLE', 400],
    ['SERVICE_UNAVAILABLE', 503],
    ['INVALID_REQUEST', 400],
  ] as const)('parses the safe error code %s', async (code, status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: false, code }, status)))
    await expect(issueRunTicket(measurement)).rejects.toEqual(new RunTicketIssueError(code))
  })
})
