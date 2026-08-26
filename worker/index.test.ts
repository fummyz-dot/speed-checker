import { describe, expect, it, vi } from 'vitest'
import { handleConnectionRequest, handleRequest } from './index'

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

const createEnv = () => {
  const fetch = vi.fn(() => new Response('asset'))
  return { env: { ASSETS: { fetch } } as unknown as Env, fetch }
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
