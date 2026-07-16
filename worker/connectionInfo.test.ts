import { describe, expect, it } from 'vitest'
import { buildConnectionInfo } from './connectionInfo'

describe('buildConnectionInfo', () => {
  it('公開可能なrequest.cf項目だけをレスポンスへ変換する', () => {
    const input = {
      asOrganization: 'Example Network', asn: 12345, country: 'JP', region: 'Tokyo',
      city: 'Tokyo', colo: 'NRT', httpProtocol: 'HTTP/3',
      latitude: '35.0', longitude: '139.0', postalCode: '100-0001',
    }
    const result = buildConnectionInfo(input)
    expect(result).toEqual({
      provider: 'Example Network', asn: 12345, country: 'JP', region: 'Tokyo', city: 'Tokyo',
      cloudflareColo: 'NRT', protocol: 'HTTP/3',
    })
    expect(result).not.toHaveProperty('latitude')
    expect(result).not.toHaveProperty('longitude')
    expect(result).not.toHaveProperty('postalCode')
    expect(result).not.toHaveProperty('ip')
  })

  it('request.cfがない場合は全項目をnullにする', () => {
    expect(Object.values(buildConnectionInfo(undefined))).toEqual(Array(7).fill(null))
  })
})
