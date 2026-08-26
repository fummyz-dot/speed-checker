export interface ConnectionInfo {
  provider: string | null
  asn: number | null
  country: string | null
  region: string | null
  city: string | null
  cloudflareColo: string | null
  protocol: string | null
  edgeRttMs: number | null
  edgeRttTransport: 'TCP' | 'QUIC' | null
}

const stringOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null

const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const positiveNumberOrNull = (value: unknown): number | null => {
  const number = numberOrNull(value)
  return number !== null && number > 0 ? number : null
}

const getEdgeRtt = (
  cf: unknown,
  protocol: string | null,
): Pick<ConnectionInfo, 'edgeRttMs' | 'edgeRttTransport'> => {
  const tcpRtt = positiveNumberOrNull(readField(cf, 'clientTcpRtt'))
  const quicRtt = positiveNumberOrNull(readField(cf, 'clientQuicRtt'))

  if (protocol === 'HTTP/3' && quicRtt !== null) {
    return { edgeRttMs: quicRtt, edgeRttTransport: 'QUIC' }
  }
  if (tcpRtt !== null) return { edgeRttMs: tcpRtt, edgeRttTransport: 'TCP' }
  if (quicRtt !== null) return { edgeRttMs: quicRtt, edgeRttTransport: 'QUIC' }
  return { edgeRttMs: null, edgeRttTransport: null }
}

export const buildConnectionInfo = (
  cf: unknown,
): ConnectionInfo => {
  const protocol = stringOrNull(readField(cf, 'httpProtocol'))

  return {
    provider: stringOrNull(readField(cf, 'asOrganization')),
    asn: numberOrNull(readField(cf, 'asn')),
    country: stringOrNull(readField(cf, 'country')),
    region: stringOrNull(readField(cf, 'region')),
    city: stringOrNull(readField(cf, 'city')),
    cloudflareColo: stringOrNull(readField(cf, 'colo')),
    protocol,
    ...getEdgeRtt(cf, protocol),
  }
}

const readField = (value: unknown, field: string): unknown =>
  typeof value === 'object' && value !== null
    ? Reflect.get(value, field)
    : undefined
