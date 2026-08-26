import { buildConnectionInfo } from './connectionInfo'

const CANONICAL_HOSTNAME = 'netspeedrace.com'
const WWW_HOSTNAME = 'www.netspeedrace.com'

const jsonHeaders = {
  'Cache-Control': 'private, no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders })

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

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return jsonResponse({ error: 'Not Found' }, 404)
  }

  return env.ASSETS.fetch(request)
}

export default {
  fetch: handleRequest,
} satisfies ExportedHandler<Env>
