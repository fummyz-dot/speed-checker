import { describe, expect, it } from 'vitest'
import { buildConnectionInfo } from './connectionInfo'

describe('buildConnectionInfo', () => {
  it('公開可能なrequest.cf項目だけをレスポンスへ変換する', () => {
    const input = {
      asOrganization: 'Example Network', asn: 12345, country: 'JP', region: 'Tokyo',
      city: 'Tokyo', colo: 'NRT', httpProtocol: 'HTTP/3', clientQuicRtt: 42,
      latitude: '35.0', longitude: '139.0', postalCode: '100-0001',
    }
    const result = buildConnectionInfo(input)
    expect(result).toEqual({
      provider: 'Example Network', asn: 12345, country: 'JP', region: 'Tokyo', city: 'Tokyo',
      cloudflareColo: 'NRT', protocol: 'HTTP/3', edgeRttMs: 42, edgeRttTransport: 'QUIC',
    })
    expect(result).not.toHaveProperty('latitude')
    expect(result).not.toHaveProperty('longitude')
    expect(result).not.toHaveProperty('postalCode')
    expect(result).not.toHaveProperty('ip')
  })

  it('request.cfがない場合は全項目をnullにする', () => {
    expect(Object.values(buildConnectionInfo(undefined))).toEqual(Array(9).fill(null))
  })

  it('HTTP/1・HTTP/2では有効なTCP RTTを優先する', () => {
    expect(buildConnectionInfo({ httpProtocol: 'HTTP/2', clientTcpRtt: 22, clientQuicRtt: 42 }))
      .toMatchObject({ edgeRttMs: 22, edgeRttTransport: 'TCP' })
  })

  it('HTTP/3では有効なQUIC RTTを優先し、TCPがなくてもQUICを採用する', () => {
    expect(buildConnectionInfo({ httpProtocol: 'HTTP/3', clientTcpRtt: 22, clientQuicRtt: 42 }))
      .toMatchObject({ edgeRttMs: 42, edgeRttTransport: 'QUIC' })
    expect(buildConnectionInfo({ httpProtocol: 'HTTP/2', clientQuicRtt: 42 }))
      .toMatchObject({ edgeRttMs: 42, edgeRttTransport: 'QUIC' })
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, '22'])(
    '不正なRTT値 %p は公開しない',
    (invalidRtt) => {
      expect(buildConnectionInfo({ clientTcpRtt: invalidRtt, clientQuicRtt: invalidRtt }))
        .toMatchObject({ edgeRttMs: null, edgeRttTransport: null })
    },
  )

})
