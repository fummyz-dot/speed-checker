export interface IssuedRunTicket {
  ok: true
  ticket: string
  expiresAtMs: number
}

export interface StoredRunTicket {
  version: 1
  ticket: string
  expiresAtMs: number
}
