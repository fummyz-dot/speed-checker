import { buildConnectionInfo } from './connectionInfo'

const CANONICAL_HOSTNAME = 'netspeedrace.com'
const WWW_HOSTNAME = 'www.netspeedrace.com'
const RANKING_MAX_BODY_BYTES = 8192
const RANKING_CONTEXT_URL = 'https://ranking.internal/internal/ranking/context'
const RANKING_SUBMIT_URL = 'https://ranking.internal/internal/ranking/submit'

type RankingServiceEnv = Env & { RANKING_SERVICE: Fetcher }

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

const getRequestCountry = (request: Request): string =>
  typeof request.cf?.country === 'string' ? request.cf.country : ''

const isExactObject = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false

  const valueKeys = Object.keys(value)
  return valueKeys.length === keys.length && keys.every((key) => Object.hasOwn(value, key))
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

  if (pathname === '/api/ranking/entries') {
    return handleRankingEntriesRequest(request, env as RankingServiceEnv)
  }

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return jsonResponse({ error: 'Not Found' }, 404)
  }

  return env.ASSETS.fetch(request)
}

export default {
  fetch: handleRequest,
} satisfies ExportedHandler<Env>
