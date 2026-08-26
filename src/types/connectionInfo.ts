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

export type ConnectionInfoState =
  | { status: 'loading' }
  | { status: 'success'; data: ConnectionInfo }
  | { status: 'error'; message: string }
