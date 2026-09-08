import type { IssuedRunTicket, StoredRunTicket } from './types'

export const RUN_TICKET_STORAGE_KEY = 'net-speed-run-ticket-v1'

const isExactObject = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const valueKeys = Object.keys(value)
  return valueKeys.length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

const isValidStoredRunTicket = (value: unknown, nowMs: number): value is StoredRunTicket =>
  isExactObject(value, ['version', 'ticket', 'expiresAtMs'])
  && value.version === 1
  && typeof value.ticket === 'string'
  && value.ticket.length > 0
  && typeof value.expiresAtMs === 'number'
  && Number.isSafeInteger(value.expiresAtMs)
  && value.expiresAtMs > nowMs

export const removeStoredRunTicket = (storage: Storage = window.sessionStorage): void => {
  try {
    storage.removeItem(RUN_TICKET_STORAGE_KEY)
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export const saveRunTicket = (
  issued: IssuedRunTicket,
  storage: Storage = window.sessionStorage,
  nowMs = Date.now(),
): StoredRunTicket => {
  const stored: StoredRunTicket = {
    version: 1,
    ticket: issued.ticket,
    expiresAtMs: issued.expiresAtMs,
  }
  if (!isValidStoredRunTicket(stored, nowMs)) {
    throw new Error('Invalid Run Ticket storage value')
  }
  storage.setItem(RUN_TICKET_STORAGE_KEY, JSON.stringify(stored))
  return stored
}

export const loadRunTicket = (
  storage: Storage = window.sessionStorage,
  nowMs = Date.now(),
): StoredRunTicket | null => {
  let raw: string | null
  try {
    raw = storage.getItem(RUN_TICKET_STORAGE_KEY)
  } catch {
    return null
  }
  if (raw === null) return null

  try {
    const value: unknown = JSON.parse(raw)
    if (isValidStoredRunTicket(value, nowMs)) return value
  } catch {
    // Invalid values are removed below.
  }
  removeStoredRunTicket(storage)
  return null
}
