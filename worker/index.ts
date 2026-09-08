import { buildConnectionInfo } from './connectionInfo'
import {
  mapScoreTenthsToRunTimeTenths,
  RUN_SCORE_MAX_TENTHS,
} from './runTimeMapping'
import {
  issueRunTicket,
  RUN_TICKET_SCORE_VERSION,
  RunTicketError,
  verifyRunTicket,
} from './runTicket'

const CANONICAL_HOSTNAME = 'netspeedrace.com'
const WWW_HOSTNAME = 'www.netspeedrace.com'
const RANKING_MAX_BODY_BYTES = 8192
const RANKING_CONTEXT_URL = 'https://ranking.internal/internal/ranking/context'
const RANKING_OVERVIEW_URL = 'https://ranking.internal/internal/ranking/overview'
const RANKING_SUBMIT_URL = 'https://ranking.internal/internal/ranking/submit'
const RUN_SCORE_URL = 'https://ranking.internal/internal/run/score'
const RUN_TICKET_MAX_BODY_BYTES = 4096

type RankingServiceEnv = Env & { RANKING_SERVICE: Fetcher }
type RunTicketEnv = RankingServiceEnv & { RUN_TICKET_HMAC_SECRET?: string }

const rankingRequestHeaders = { 'Content-Type': 'application/json' }

const jsonHeaders = {
  'Cache-Control': 'private, no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders })

const invalidRankingRequest = (): Response =>
  jsonResponse({ ok: false, code: 'INVALID_REQUEST' }, 400)

const serviceUnavailable = (): Response =>
  jsonResponse({ ok: false, code: 'SERVICE_UNAVAILABLE' }, 503)

const runTicketErrorResponse = (error: unknown): Response => {
  if (error instanceof RunTicketError) {
    if (error.code === 'ticket_configuration_error') return serviceUnavailable()
    if (error.code === 'ticket_expired') {
      return jsonResponse({ ok: false, code: 'RUN_TICKET_EXPIRED' }, 403)
    }
    return jsonResponse({ ok: false, code: 'INVALID_RUN_TICKET' }, 403)
  }
  return serviceUnavailable()
}

const getRequestCountry = (request: Request): string =>
  typeof request.cf?.country === 'string' ? request.cf.country : ''

const isExactObject = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false

  const valueKeys = Object.keys(value)
  return valueKeys.length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

const readRunTicketJson = async (request: Request): Promise<{ ok: true, value: unknown } | { ok: false }> => {
  try {
    const contentLength = request.headers.get('Content-Length')
    if (contentLength !== null
      && (!/^\d+$/u.test(contentLength) || Number(contentLength) > RUN_TICKET_MAX_BODY_BYTES)) {
      return { ok: false }
    }

    const bodyBytes = await request.arrayBuffer()
    if (bodyBytes.byteLength > RUN_TICKET_MAX_BODY_BYTES) return { ok: false }
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bodyBytes)) }
  } catch {
    return { ok: false }
  }
}

type RunScoreResult =
  | { ok: true, scoreTenths: number }
  | { ok: false, measurementNotEligible: boolean }

const requestRunScore = async (
  env: RankingServiceEnv,
  measurement: Record<string, unknown>,
): Promise<RunScoreResult> => {
  try {
    const response = await env.RANKING_SERVICE.fetch(new Request(RUN_SCORE_URL, {
      method: 'POST',
      headers: rankingRequestHeaders,
      body: JSON.stringify({ measurement }),
    }))
    const contentLength = response.headers.get('Content-Length')
    if (contentLength !== null
      && (!/^\d+$/u.test(contentLength) || Number(contentLength) > RUN_TICKET_MAX_BODY_BYTES)) {
      return { ok: false, measurementNotEligible: false }
    }

    const bodyBytes = await response.arrayBuffer()
    if (bodyBytes.byteLength > RUN_TICKET_MAX_BODY_BYTES) {
      return { ok: false, measurementNotEligible: false }
    }
    const body: unknown = JSON.parse(new TextDecoder().decode(bodyBytes))

    if (response.status === 400
      && isExactObject(body, ['ok', 'code'])
      && body.ok === false
      && body.code === 'MEASUREMENT_NOT_ELIGIBLE') {
      return { ok: false, measurementNotEligible: true }
    }

    if (response.status !== 200
      || !isExactObject(body, ['ok', 'scoreTenths', 'scoreVersion'])
      || body.ok !== true
      || typeof body.scoreTenths !== 'number'
      || !Number.isSafeInteger(body.scoreTenths)
      || body.scoreTenths < 0
      || body.scoreTenths > RUN_SCORE_MAX_TENTHS
      || body.scoreVersion !== RUN_TICKET_SCORE_VERSION) {
      return { ok: false, measurementNotEligible: false }
    }

    return { ok: true, scoreTenths: body.scoreTenths }
  } catch {
    return { ok: false, measurementNotEligible: false }
  }
}

const relayRankingRequest = async (
  env: RankingServiceEnv,
  url: string,
  body: unknown,
): Promise<Response> => {
  try {
    const response = await env.RANKING_SERVICE.fetch(new Request(url, {
      method: 'POST',
      headers: rankingRequestHeaders,
      body: JSON.stringify(body),
    }))
    return new Response(response.body, { status: response.status, headers: jsonHeaders })
  } catch {
    return serviceUnavailable()
  }
}

export const handleRankingContextRequest = (
  request: Request,
  env: RankingServiceEnv,
): Response | Promise<Response> => {
  if (request.method !== 'GET') {
    const response = jsonResponse({ error: 'Method Not Allowed' }, 405)
    response.headers.set('Allow', 'GET')
    return response
  }

  return relayRankingRequest(env, RANKING_CONTEXT_URL, { country: getRequestCountry(request) })
}

export const handleRankingOverviewRequest = async (
  request: Request,
  env: RankingServiceEnv,
): Promise<Response> => {
  if (request.method !== 'GET') {
    const response = jsonResponse({ error: 'Method Not Allowed' }, 405)
    response.headers.set('Allow', 'GET')
    return response
  }

  try {
    const response = await env.RANKING_SERVICE.fetch(new Request(RANKING_OVERVIEW_URL, {
      method: 'GET',
    }))
    return new Response(response.body, { status: response.status, headers: jsonHeaders })
  } catch {
    return serviceUnavailable()
  }
}

export const handleRankingEntriesRequest = async (
  request: Request,
  env: RankingServiceEnv,
): Promise<Response> => {
  if (request.method !== 'POST') {
    const response = jsonResponse({ error: 'Method Not Allowed' }, 405)
    response.headers.set('Allow', 'POST')
    return response
  }

  const contentLength = request.headers.get('Content-Length')
  if (contentLength !== null && Number(contentLength) > RANKING_MAX_BODY_BYTES) {
    return invalidRankingRequest()
  }

  const bodyBytes = await request.arrayBuffer()
  if (bodyBytes.byteLength > RANKING_MAX_BODY_BYTES) return invalidRankingRequest()

  let body: unknown
  try {
    body = JSON.parse(new TextDecoder().decode(bodyBytes))
  } catch {
    return invalidRankingRequest()
  }

  if (!isExactObject(body, ['ticket', 'turnstileToken', 'measurement'])
    || !isExactObject(body.measurement, ['id', 'downloadMbps', 'uploadMbps', 'pingMs', 'jitterMs'])) {
    return invalidRankingRequest()
  }

  return relayRankingRequest(env, RANKING_SUBMIT_URL, {
    country: getRequestCountry(request),
    ticket: body.ticket,
    turnstileToken: body.turnstileToken,
    measurement: body.measurement,
  })
}

export const handleRunTicketRequest = async (
  request: Request,
  env: RunTicketEnv,
): Promise<Response> => {
  if (request.method !== 'POST') {
    const response = jsonResponse({ error: 'Method Not Allowed' }, 405)
    response.headers.set('Allow', 'POST')
    return response
  }

  const parsed = await readRunTicketJson(request)
  if (!parsed.ok
    || !isExactObject(parsed.value, ['measurement'])
    || !isExactObject(parsed.value.measurement, [
      'id', 'downloadMbps', 'uploadMbps', 'pingMs', 'jitterMs',
    ])) {
    return invalidRankingRequest()
  }

  if (!env.RUN_TICKET_HMAC_SECRET) return serviceUnavailable()

  const score = await requestRunScore(env, parsed.value.measurement)
  if (!score.ok) {
    return score.measurementNotEligible
      ? jsonResponse({ ok: false, code: 'MEASUREMENT_NOT_ELIGIBLE' }, 400)
      : serviceUnavailable()
  }

  try {
    const runTimeTenths = mapScoreTenthsToRunTimeTenths(score.scoreTenths)
    const { ticket, payload } = await issueRunTicket(
      env.RUN_TICKET_HMAC_SECRET,
      runTimeTenths,
    )
    return jsonResponse({ ok: true, ticket, expiresAtMs: payload.expiresAtMs })
  } catch (error) {
    return runTicketErrorResponse(error)
  }
}

export const handleRunTicketVerifyRequest = async (
  request: Request,
  env: RunTicketEnv,
): Promise<Response> => {
  if (request.method !== 'POST') {
    const response = jsonResponse({ error: 'Method Not Allowed' }, 405)
    response.headers.set('Allow', 'POST')
    return response
  }

  const parsed = await readRunTicketJson(request)
  if (!parsed.ok
    || !isExactObject(parsed.value, ['ticket'])
    || typeof parsed.value.ticket !== 'string'
    || parsed.value.ticket.length === 0) {
    return invalidRankingRequest()
  }

  try {
    const payload = await verifyRunTicket(
      parsed.value.ticket,
      env.RUN_TICKET_HMAC_SECRET,
    )
    return jsonResponse({
      ok: true,
      runTimeSec: payload.runTimeTenths / 10,
      expiresAtMs: payload.expiresAtMs,
    })
  } catch (error) {
    return runTicketErrorResponse(error)
  }
}

export const handleConnectionRequest = (request: Request): Response => {
  if (request.method !== 'GET') {
    const response = jsonResponse({ error: 'Method Not Allowed' }, 405)
    response.headers.set('Allow', 'GET')
    return response
  }

  try {
    return jsonResponse(buildConnectionInfo(request.cf))
  } catch {
    return jsonResponse({ error: 'Connection information is unavailable' }, 500)
  }
}

export const getCanonicalRedirect = (request: Request): Response | null => {
  const url = new URL(request.url)
  const shouldRedirect = url.hostname === WWW_HOSTNAME
    || (url.hostname === CANONICAL_HOSTNAME && url.protocol === 'http:')

  if (!shouldRedirect) return null

  url.protocol = 'https:'
  url.hostname = CANONICAL_HOSTNAME
  url.port = ''
  return Response.redirect(url.toString(), 301)
}

export const handleRequest = (request: Request, env: Env): Response | Promise<Response> => {
  const canonicalRedirect = getCanonicalRedirect(request)
  if (canonicalRedirect) return canonicalRedirect

  const { pathname } = new URL(request.url)

  if (pathname === '/api/connection') {
    return handleConnectionRequest(request)
  }

  if (pathname === '/api/ranking/context') {
    return handleRankingContextRequest(request, env as RankingServiceEnv)
  }

  if (pathname === '/api/ranking/overview') {
    return handleRankingOverviewRequest(request, env as RankingServiceEnv)
  }

  if (pathname === '/api/ranking/entries') {
    return handleRankingEntriesRequest(request, env as RankingServiceEnv)
  }

  if (pathname === '/api/run-ticket') {
    return handleRunTicketRequest(request, env as RunTicketEnv)
  }

  if (pathname === '/api/run-ticket/verify') {
    return handleRunTicketVerifyRequest(request, env as RunTicketEnv)
  }

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return jsonResponse({ error: 'Not Found' }, 404)
  }

  return env.ASSETS.fetch(request)
}

export default {
  fetch: handleRequest,
} satisfies ExportedHandler<Env>
