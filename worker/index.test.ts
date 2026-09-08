import { describe, expect, it, vi } from 'vitest'
import { handleConnectionRequest, handleRequest } from './index'
import { issueRunTicket, RUN_TICKET_TTL_MS } from './runTicket'

const RUN_TICKET_TEST_SECRET = 'dedicated-run-ticket-test-secret'
const RUN_TICKET_TEST_NOW_MS = Date.UTC(2026, 8, 8, 0, 0, 0)

const requestWithCf = (method = 'GET'): Request => {
  const request = new Request('https://example.com/api/connection', { method })
  Object.defineProperty(request, 'cf', {
    value: {
      asOrganization: 'Example Network', asn: 12345, country: 'JP', region: 'Tokyo',
      city: 'Tokyo', colo: 'NRT', httpProtocol: 'HTTP/3',
    },
  })
  return request
}

const createEnv = (runTicketSecret: string | null = RUN_TICKET_TEST_SECRET) => {
  const fetch = vi.fn(() => new Response('asset'))
  const rankingFetch = vi.fn(() => new Response(JSON.stringify({ ok: true })))
  return {
    env: {
      ASSETS: { fetch },
      RANKING_SERVICE: { fetch: rankingFetch },
      RUN_TICKET_HMAC_SECRET: runTicketSecret ?? undefined,
    } as unknown as Env,
    fetch,
    rankingFetch,
  }
}

const rankingRequest = (
  pathname: '/api/ranking/context' | '/api/ranking/overview' | '/api/ranking/entries',
  init: RequestInit = {},
  country: unknown = 'JP',
): Request => {
  const request = new Request(`https://example.com${pathname}`, init)
  Object.defineProperty(request, 'cf', { value: { country } })
  return request
}

const runTicketRequest = (
  pathname: '/api/run-ticket' | '/api/run-ticket/verify',
  body: unknown,
  method = 'POST',
): Request => new Request(`https://example.com${pathname}`, {
  method,
  ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
})

const measurement = {
  id: 'measurement',
  downloadMbps: 100,
  uploadMbps: 30,
  pingMs: 30,
  jitterMs: 8,
}

describe('handleConnectionRequest', () => {
  it('安全なJSONとセキュリティヘッダーを返す', async () => {
    const response = handleConnectionRequest(requestWithCf())
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(await response.json()).toEqual({
      provider: 'Example Network', asn: 12345, country: 'JP', region: 'Tokyo', city: 'Tokyo',
      cloudflareColo: 'NRT', protocol: 'HTTP/3', edgeRttMs: null, edgeRttTransport: null,
    })
  })

  it('IPや詳細位置情報を返さない', async () => {
    const body = JSON.stringify(await handleConnectionRequest(requestWithCf()).json())
    expect(body).not.toMatch(/ip|latitude|longitude|postalCode/i)
  })

  it('GET以外には405を返す', () => {
    expect(handleConnectionRequest(requestWithCf('POST')).status).toBe(405)
  })
})

describe('handleRequest canonical host routing', () => {
  it('apex HTTPSはredirectせずStatic Assetsへ渡す', async () => {
    const { env, fetch } = createEnv()
    const request = new Request('https://netspeedrace.com/robots.txt')

    const response = await handleRequest(request, env)

    expect(response.status).toBe(200)
    expect(fetch).toHaveBeenCalledWith(request)
  })

  it('apex HTTPをpathnameとquery stringを維持してHTTPSへ301 redirectする', async () => {
    const { env, fetch } = createEnv()

    const response = await handleRequest(new Request('http://netspeedrace.com/foo?a=1'), env)

    expect(response.status).toBe(301)
    expect(response.headers.get('Location')).toBe('https://netspeedrace.com/foo?a=1')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('www HTTPSをpathnameとquery stringを維持してapex HTTPSへ301 redirectする', async () => {
    const { env, fetch } = createEnv()

    const response = await handleRequest(new Request('https://www.netspeedrace.com/robots.txt?source=www'), env)

    expect(response.status).toBe(301)
    expect(response.headers.get('Location')).toBe('https://netspeedrace.com/robots.txt?source=www')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('www APIもAPI処理より前にapex HTTPSへ301 redirectする', async () => {
    const { env, fetch } = createEnv()

    const response = await handleRequest(new Request('https://www.netspeedrace.com/api/connection?probe=1'), env)

    expect(response.status).toBe(301)
    expect(response.headers.get('Location')).toBe('https://netspeedrace.com/api/connection?probe=1')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('localhost/dev相当のhostnameをproductionへredirectしない', async () => {
    const { env, fetch } = createEnv()
    const request = new Request('http://localhost:8787/preview?mode=dev')

    const response = await handleRequest(request, env)

    expect(response.status).toBe(200)
    expect(response.headers.get('Location')).toBeNull()
    expect(fetch).toHaveBeenCalledWith(request)
  })
})

describe('ranking service proxy', () => {
  it('context requestを国コードだけでPrivate Workerへ中継する', async () => {
    const { env, rankingFetch } = createEnv()
    rankingFetch.mockReturnValue(new Response(JSON.stringify({ country: 'JP' }), {
      status: 201,
      headers: { 'X-Private-Header': 'hidden' },
    }))
    const request = rankingRequest('/api/ranking/context', {
      headers: {
        'CF-Connecting-IP': '203.0.113.1',
        Cookie: 'session=secret',
        'User-Agent': 'private-agent',
        'X-Forwarded-For': '203.0.113.1',
      },
    })

    const response = await handleRequest(request, env)
    const privateRequest = rankingFetch.mock.calls[0][0] as Request

    expect(rankingFetch).toHaveBeenCalledTimes(1)
    expect(privateRequest.url).toBe('https://ranking.internal/internal/ranking/context')
    expect(privateRequest.method).toBe('POST')
    expect(await privateRequest.json()).toEqual({ country: 'JP' })
    expect([...privateRequest.headers.entries()]).toEqual([['content-type', 'application/json']])
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ country: 'JP' })
    expect(response.headers.get('X-Private-Header')).toBeNull()
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('context service failureは503にする', async () => {
    const { env, rankingFetch } = createEnv()
    rankingFetch.mockImplementation(() => { throw new Error('private failure') })

    const response = await handleRequest(rankingRequest('/api/ranking/context'), env)

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ ok: false, code: 'SERVICE_UNAVAILABLE' })
  })

  it('overview requestをクライアント情報なしでPrivate Workerへ中継する', async () => {
    const { env, rankingFetch } = createEnv()
    const overview = {
      ok: true,
      rankingDay: '2026-09-04',
      scoreVersion: 1,
      totalRuns: 3,
      medianScoreTenths: 4910,
      top10ThresholdTenths: null,
      top3: [],
      champion: {
        source: 'fallback',
        sourceDay: null,
        scoreTenths: null,
        downloadTenths: 7000,
        uploadTenths: 2500,
        qualifyingRuns: 0,
      },
      recentDays: [],
    }
    rankingFetch.mockReturnValue(new Response(JSON.stringify(overview), {
      status: 200,
      headers: { 'X-Private-Header': 'hidden' },
    }))
    const request = new Request('https://example.com/api/ranking/overview?client=query', {
      headers: {
        'CF-Connecting-IP': '203.0.113.1',
        Cookie: 'session=secret',
        'User-Agent': 'private-agent',
        'X-Forwarded-For': '203.0.113.1',
        Authorization: 'Bearer secret',
        Referer: 'https://example.net/',
      },
    })
    Object.defineProperty(request, 'cf', { value: { country: 'JP' } })

    const response = await handleRequest(request, env)
    const privateRequest = rankingFetch.mock.calls[0][0] as Request

    expect(rankingFetch).toHaveBeenCalledTimes(1)
    expect(privateRequest.url).toBe('https://ranking.internal/internal/ranking/overview')
    expect(privateRequest.method).toBe('GET')
    expect(privateRequest.body).toBeNull()
    expect([...privateRequest.headers.entries()]).toEqual([])
    expect(privateRequest.headers.get('CF-Connecting-IP')).toBeNull()
    expect(privateRequest.headers.get('Cookie')).toBeNull()
    expect(privateRequest.headers.get('User-Agent')).toBeNull()
    expect(privateRequest.headers.get('X-Forwarded-For')).toBeNull()
    expect(privateRequest.headers.get('Authorization')).toBeNull()
    expect(privateRequest.headers.get('Referer')).toBeNull()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(overview)
    expect(response.headers.get('X-Private-Header')).toBeNull()
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('overview POSTは405にする', async () => {
    const { env, rankingFetch } = createEnv()

    const response = await handleRequest(rankingRequest('/api/ranking/overview', { method: 'POST' }), env)

    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toBe('GET')
    expect(rankingFetch).not.toHaveBeenCalled()
  })

  it('overview service failureは503にする', async () => {
    const { env, rankingFetch } = createEnv()
    rankingFetch.mockImplementation(() => { throw new Error('private failure') })

    const response = await handleRequest(rankingRequest('/api/ranking/overview'), env)

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ ok: false, code: 'SERVICE_UNAVAILABLE' })
  })

  it('entries requestを国コード付きの許可済みpayloadだけでPrivate Workerへ中継する', async () => {
    const { env, rankingFetch } = createEnv()
    const response = await handleRequest(rankingRequest('/api/ranking/entries', {
      method: 'POST',
      body: JSON.stringify({
        ticket: 'ticket',
        turnstileToken: 'token',
        measurement: { id: 'measurement', downloadMbps: 100, uploadMbps: 50, pingMs: 12, jitterMs: 3 },
      }),
    }), env)
    const privateRequest = rankingFetch.mock.calls[0][0] as Request

    expect(rankingFetch).toHaveBeenCalledTimes(1)
    expect(privateRequest.url).toBe('https://ranking.internal/internal/ranking/submit')
    expect(privateRequest.method).toBe('POST')
    expect(await privateRequest.json()).toEqual({
      country: 'JP',
      ticket: 'ticket',
      turnstileToken: 'token',
      measurement: { id: 'measurement', downloadMbps: 100, uploadMbps: 50, pingMs: 12, jitterMs: 3 },
    })
    expect(response.status).toBe(200)
  })

  it.each([
    ['client country', { ticket: 'ticket', turnstileToken: 'token', country: 'US', measurement: { id: 'id', downloadMbps: 1, uploadMbps: 1, pingMs: 1, jitterMs: 1 } }],
    ['unknown top-level field', { ticket: 'ticket', turnstileToken: 'token', score: 1, measurement: { id: 'id', downloadMbps: 1, uploadMbps: 1, pingMs: 1, jitterMs: 1 } }],
    ['unknown measurement field', { ticket: 'ticket', turnstileToken: 'token', measurement: { id: 'id', downloadMbps: 1, uploadMbps: 1, pingMs: 1, jitterMs: 1, score: 1 } }],
  ])('entries rejects %s', async (_caseName, body) => {
    const { env, rankingFetch } = createEnv()

    const response = await handleRequest(rankingRequest('/api/ranking/entries', {
      method: 'POST', body: JSON.stringify(body),
    }), env)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, code: 'INVALID_REQUEST' })
    expect(rankingFetch).not.toHaveBeenCalled()
  })

  it('entries rejects invalid JSON and oversized bodies', async () => {
    const { env, rankingFetch } = createEnv()
    const invalidJson = await handleRequest(rankingRequest('/api/ranking/entries', {
      method: 'POST', body: '{',
    }), env)
    const oversized = await handleRequest(rankingRequest('/api/ranking/entries', {
      method: 'POST', body: 'x'.repeat(8193),
    }), env)

    expect(invalidJson.status).toBe(400)
    expect(oversized.status).toBe(400)
    expect(rankingFetch).not.toHaveBeenCalled()
  })

  it('entries GETは405にする', async () => {
    const { env, rankingFetch } = createEnv()

    const response = await handleRequest(rankingRequest('/api/ranking/entries'), env)

    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toBe('POST')
    expect(rankingFetch).not.toHaveBeenCalled()
  })

  it('entries service failureは503にする', async () => {
    const { env, rankingFetch } = createEnv()
    rankingFetch.mockImplementation(() => { throw new Error('private failure') })

    const response = await handleRequest(rankingRequest('/api/ranking/entries', {
      method: 'POST',
      body: JSON.stringify({
        ticket: 'ticket', turnstileToken: 'token',
        measurement: { id: 'id', downloadMbps: 1, uploadMbps: 1, pingMs: 1, jitterMs: 1 },
      }),
    }), env)

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ ok: false, code: 'SERVICE_UNAVAILABLE' })
  })

  it('unknown API routeは404を維持する', async () => {
    const { env, fetch, rankingFetch } = createEnv()

    const response = await handleRequest(new Request('https://example.com/api/foo'), env)

    expect(response.status).toBe(404)
    expect(fetch).not.toHaveBeenCalled()
    expect(rankingFetch).not.toHaveBeenCalled()
  })
})

describe('Run Ticket API', () => {
  it('issues a ticket from the private score and verifies runTimeSec without another service call', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(RUN_TICKET_TEST_NOW_MS)
    const { env, rankingFetch } = createEnv()
    rankingFetch.mockReturnValue(new Response(JSON.stringify({
      ok: true, scoreTenths: 5_003, scoreVersion: 1,
    })))
    const clientRequest = runTicketRequest('/api/run-ticket', { measurement })
    clientRequest.headers.set('CF-Connecting-IP', '203.0.113.1')
    clientRequest.headers.set('Cookie', 'session=secret')

    const issueResponse = await handleRequest(clientRequest, env)
    const issueBody = await issueResponse.json() as {
      ok: boolean, ticket: string, expiresAtMs: number
    }
    const privateRequest = rankingFetch.mock.calls[0][0] as Request

    expect(issueResponse.status).toBe(200)
    expect(issueResponse.headers.get('Cache-Control')).toBe('private, no-store')
    expect(issueResponse.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(issueBody).toMatchObject({
      ok: true,
      expiresAtMs: RUN_TICKET_TEST_NOW_MS + RUN_TICKET_TTL_MS,
    })
    expect(Object.keys(issueBody).sort()).toEqual(['expiresAtMs', 'ok', 'ticket'])
    expect(privateRequest.url).toBe('https://ranking.internal/internal/run/score')
    expect(privateRequest.method).toBe('POST')
    expect([...privateRequest.headers.entries()]).toEqual([['content-type', 'application/json']])
    expect(await privateRequest.json()).toEqual({ measurement })

    const verifyResponse = await handleRequest(
      runTicketRequest('/api/run-ticket/verify', { ticket: issueBody.ticket }),
      env,
    )
    expect(verifyResponse.status).toBe(200)
    expect(await verifyResponse.json()).toEqual({
      ok: true,
      runTimeSec: 39.7,
      expiresAtMs: RUN_TICKET_TEST_NOW_MS + RUN_TICKET_TTL_MS,
    })
    expect(rankingFetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    [8_500, 50],
    [16_243, 50],
  ])('clamps private scoreTenths %d to %d seconds', async (scoreTenths, runTimeSec) => {
    vi.spyOn(Date, 'now').mockReturnValue(RUN_TICKET_TEST_NOW_MS)
    const { env, rankingFetch } = createEnv()
    rankingFetch.mockReturnValue(new Response(JSON.stringify({ ok: true, scoreTenths, scoreVersion: 1 })))

    const issueResponse = await handleRequest(
      runTicketRequest('/api/run-ticket', { measurement }),
      env,
    )
    const issueBody = await issueResponse.json() as { ticket: string }
    const verifyResponse = await handleRequest(
      runTicketRequest('/api/run-ticket/verify', { ticket: issueBody.ticket }),
      env,
    )

    expect(await verifyResponse.json()).toMatchObject({ ok: true, runTimeSec })
  })

  it.each([
    ['unknown field', { ok: true, scoreTenths: 5_003, scoreVersion: 1, rank: 1 }],
    ['negative score', { ok: true, scoreTenths: -1, scoreVersion: 1 }],
    ['score above validated maximum', { ok: true, scoreTenths: 20_609, scoreVersion: 1 }],
    ['non-integer score', { ok: true, scoreTenths: 5_003.5, scoreVersion: 1 }],
  ])('fails closed for a malformed private response with %s', async (_caseName, privateBody) => {
    const { env, rankingFetch } = createEnv()
    rankingFetch.mockReturnValue(new Response(JSON.stringify(privateBody)))

    const response = await handleRequest(runTicketRequest('/api/run-ticket', { measurement }), env)

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ ok: false, code: 'SERVICE_UNAVAILABLE' })
  })

  it('fails closed for a private score version mismatch', async () => {
    const { env, rankingFetch } = createEnv()
    rankingFetch.mockReturnValue(new Response(JSON.stringify({
      ok: true, scoreTenths: 5_003, scoreVersion: 2,
    })))

    const response = await handleRequest(runTicketRequest('/api/run-ticket', { measurement }), env)

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ ok: false, code: 'SERVICE_UNAVAILABLE' })
  })

  it('safely converts the private SCORE_VERSION_MISMATCH error', async () => {
    const { env, rankingFetch } = createEnv()
    rankingFetch.mockReturnValue(new Response(JSON.stringify({
      ok: false, code: 'SCORE_VERSION_MISMATCH',
    }), { status: 409 }))

    const response = await handleRequest(runTicketRequest('/api/run-ticket', { measurement }), env)

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ ok: false, code: 'SERVICE_UNAVAILABLE' })
  })

  it('passes through the allow-listed measurement rejection without issuing a ticket', async () => {
    const { env, rankingFetch } = createEnv()
    rankingFetch.mockReturnValue(new Response(JSON.stringify({
      ok: false, code: 'MEASUREMENT_NOT_ELIGIBLE',
    }), { status: 400 }))

    const response = await handleRequest(runTicketRequest('/api/run-ticket', { measurement }), env)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, code: 'MEASUREMENT_NOT_ELIGIBLE' })
  })

  it('rejects wrong methods with Allow headers', async () => {
    const { env, rankingFetch } = createEnv()

    const issueResponse = await handleRequest(
      runTicketRequest('/api/run-ticket', {}, 'GET'), env,
    )
    const verifyResponse = await handleRequest(
      runTicketRequest('/api/run-ticket/verify', {}, 'GET'), env,
    )

    expect(issueResponse.status).toBe(405)
    expect(issueResponse.headers.get('Allow')).toBe('POST')
    expect(verifyResponse.status).toBe(405)
    expect(verifyResponse.headers.get('Allow')).toBe('POST')
    expect(rankingFetch).not.toHaveBeenCalled()
  })

  it('rejects invalid shapes, invalid JSON, and oversized bodies', async () => {
    const { env, rankingFetch } = createEnv()

    const extraIssue = await handleRequest(runTicketRequest('/api/run-ticket', {
      measurement, scoreTenths: 5_003,
    }), env)
    const extraMeasurement = await handleRequest(runTicketRequest('/api/run-ticket', {
      measurement: { ...measurement, scoreTenths: 5_003 },
    }), env)
    const extraVerify = await handleRequest(runTicketRequest('/api/run-ticket/verify', {
      ticket: 'ticket', scoreTenths: 5_003,
    }), env)
    const invalidVerifyShape = await handleRequest(runTicketRequest('/api/run-ticket/verify', {
      ticket: 123,
    }), env)
    const invalidJson = await handleRequest(new Request('https://example.com/api/run-ticket', {
      method: 'POST', body: '{',
    }), env)
    const oversized = await handleRequest(new Request('https://example.com/api/run-ticket', {
      method: 'POST', body: 'x'.repeat(4097),
    }), env)

    expect(extraIssue.status).toBe(400)
    expect(extraMeasurement.status).toBe(400)
    expect(extraVerify.status).toBe(400)
    expect(invalidVerifyShape.status).toBe(400)
    expect(invalidJson.status).toBe(400)
    expect(oversized.status).toBe(400)
    expect(rankingFetch).not.toHaveBeenCalled()
  })

  it('fails closed before calling the score service when the dedicated secret is missing', async () => {
    const { env, rankingFetch } = createEnv(null)

    const response = await handleRequest(runTicketRequest('/api/run-ticket', { measurement }), env)

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ ok: false, code: 'SERVICE_UNAVAILABLE' })
    expect(rankingFetch).not.toHaveBeenCalled()
  })

  it('maps tampered and expired ticket failures without calling the score service', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(RUN_TICKET_TEST_NOW_MS)
    const { env, rankingFetch } = createEnv()
    const { ticket } = await issueRunTicket(
      RUN_TICKET_TEST_SECRET, 397, RUN_TICKET_TEST_NOW_MS,
    )

    const tamperedResponse = await handleRequest(runTicketRequest('/api/run-ticket/verify', {
      ticket: `${ticket}x`,
    }), env)
    nowSpy.mockReturnValue(RUN_TICKET_TEST_NOW_MS + RUN_TICKET_TTL_MS)
    const expiredResponse = await handleRequest(runTicketRequest('/api/run-ticket/verify', {
      ticket,
    }), env)

    expect(tamperedResponse.status).toBe(403)
    expect(await tamperedResponse.json()).toEqual({ ok: false, code: 'INVALID_RUN_TICKET' })
    expect(expiredResponse.status).toBe(403)
    expect(await expiredResponse.json()).toEqual({ ok: false, code: 'RUN_TICKET_EXPIRED' })
    expect(rankingFetch).not.toHaveBeenCalled()
  })
})
