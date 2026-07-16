import { buildConnectionInfo } from './connectionInfo'

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

export default {
  fetch(request, env): Response | Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname === '/api/connection') {
      return handleConnectionRequest(request)
    }

    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return jsonResponse({ error: 'Not Found' }, 404)
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
