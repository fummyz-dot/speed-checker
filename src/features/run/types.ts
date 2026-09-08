export interface IssuedRunTicket {
  ok: true
  ticket: string
  expiresAtMs: number
}

export type RunTicketIssueErrorCode =
  | 'MEASUREMENT_NOT_ELIGIBLE'
  | 'SERVICE_UNAVAILABLE'
  | 'INVALID_REQUEST'
  | 'UNKNOWN'

export interface StoredRunTicket {
  version: 1
  ticket: string
  expiresAtMs: number
}
