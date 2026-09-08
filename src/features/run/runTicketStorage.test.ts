import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadRunTicket,
  RUN_TICKET_STORAGE_KEY,
  saveRunTicket,
} from './runTicketStorage'

const nowMs = 1_700_000_000_000
const valid = { ok: true as const, ticket: 'run-ticket', expiresAtMs: nowMs + 60_000 }

describe('Run Ticket sessionStorage', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.localStorage.clear()
  })

  it('saves and loads the exact v1 format in sessionStorage only', () => {
    expect(saveRunTicket(valid, window.sessionStorage, nowMs)).toEqual({
      version: 1, ticket: 'run-ticket', expiresAtMs: nowMs + 60_000,
    })
    expect(loadRunTicket(window.sessionStorage, nowMs)).toEqual({
      version: 1, ticket: 'run-ticket', expiresAtMs: nowMs + 60_000,
    })
    expect(window.localStorage.length).toBe(0)
  })

  it.each([
    ['invalid JSON', '{'],
    ['wrong version', JSON.stringify({ version: 2, ticket: 'run-ticket', expiresAtMs: nowMs + 1 })],
    ['empty ticket', JSON.stringify({ version: 1, ticket: '', expiresAtMs: nowMs + 1 })],
    ['expired', JSON.stringify({ version: 1, ticket: 'run-ticket', expiresAtMs: nowMs })],
    ['invalid expiry', JSON.stringify({ version: 1, ticket: 'run-ticket', expiresAtMs: 1.5 })],
    ['unknown field', JSON.stringify({ version: 1, ticket: 'run-ticket', expiresAtMs: nowMs + 1, score: 1 })],
  ])('removes and rejects %s', (_caseName, value) => {
    window.sessionStorage.setItem(RUN_TICKET_STORAGE_KEY, value)
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem')

    expect(loadRunTicket(window.sessionStorage, nowMs)).toBeNull()
    expect(removeItem).toHaveBeenCalledWith(RUN_TICKET_STORAGE_KEY)
    expect(window.sessionStorage.getItem(RUN_TICKET_STORAGE_KEY)).toBeNull()
  })

  it('rejects an invalid value instead of saving it', () => {
    expect(() => saveRunTicket({ ...valid, ticket: '' }, window.sessionStorage, nowMs)).toThrow()
    expect(window.sessionStorage.getItem(RUN_TICKET_STORAGE_KEY)).toBeNull()
  })
})
