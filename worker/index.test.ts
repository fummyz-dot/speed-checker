import { describe, expect, it } from 'vitest'
import { handleConnectionRequest } from './index'

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

describe('handleConnectionRequest', () => {
  it('安全なJSONとセキュリティヘッダーを返す', async () => {
    const response = handleConnectionRequest(requestWithCf())
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(await response.json()).toEqual({
      provider: 'Example Network', asn: 12345, country: 'JP', region: 'Tokyo', city: 'Tokyo',
      cloudflareColo: 'NRT', protocol: 'HTTP/3',
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
