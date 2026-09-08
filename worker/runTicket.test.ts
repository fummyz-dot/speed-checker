import { describe, expect, it } from 'vitest'
import {
  issueRunTicket,
  RUN_TICKET_TTL_MS,
  RunTicketError,
  verifyRunTicket,
} from './runTicket'

const secret = 'dedicated-run-ticket-test-secret'
const nowMs = Date.UTC(2026, 8, 8, 0, 0, 0)
const encoder = new TextEncoder()

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

const signPayload = async (payload: Record<string, unknown>): Promise<string> => {
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(encodedPayload)))
  return `${encodedPayload}.${toBase64Url(signature)}`
}

describe('Run Ticket', () => {
  it('issues and verifies a ticket while preserving runtime and expiry', async () => {
    const issued = await issueRunTicket(secret, 397, nowMs)

    expect(issued.payload.runTimeTenths).toBe(397)
    expect(issued.payload.expiresAtMs).toBe(nowMs + RUN_TICKET_TTL_MS)
    expect(issued.payload.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/u)
    await expect(verifyRunTicket(issued.ticket, secret, nowMs + 1)).resolves.toEqual(issued.payload)
  })

  it('rejects payload and signature tampering', async () => {
    const { ticket } = await issueRunTicket(secret, 397, nowMs)
    const [payload, signature] = ticket.split('.')
    const changedPayload = `${payload.slice(0, -1)}${payload.endsWith('A') ? 'B' : 'A'}`
    const changedSignature = `${signature.slice(0, -1)}${signature.endsWith('A') ? 'B' : 'A'}`

    await expect(verifyRunTicket(`${changedPayload}.${signature}`, secret, nowMs)).rejects
      .toMatchObject({ code: 'ticket_invalid' })
    await expect(verifyRunTicket(`${payload}.${changedSignature}`, secret, nowMs)).rejects
      .toMatchObject({ code: 'ticket_invalid' })
  })

  it.each([
    ['wrong purpose', { purpose: 'ranking' }],
    ['wrong ticket version', { version: 2 }],
    ['wrong score version', { scoreVersion: 2 }],
    ['wrong mapping version', { mappingVersion: 2 }],
    ['impossible TTL', { expiresAtMs: nowMs + RUN_TICKET_TTL_MS + 1 }],
    ['future issue time', { issuedAtMs: nowMs + 1, expiresAtMs: nowMs + 1 + RUN_TICKET_TTL_MS }],
    ['runtime below range', { runTimeTenths: 249 }],
    ['runtime above range', { runTimeTenths: 501 }],
    ['non-integer runtime', { runTimeTenths: 397.5 }],
    ['malformed nonce', { nonce: 'not-base64url!' }],
    ['unknown field', { extra: true }],
  ])('rejects a signed payload with %s', async (_caseName, changes) => {
    const { payload } = await issueRunTicket(secret, 397, nowMs)
    const ticket = await signPayload({ ...payload, ...changes })

    await expect(verifyRunTicket(ticket, secret, nowMs)).rejects
      .toMatchObject({ code: 'ticket_invalid' })
  })

  it('distinguishes an expired ticket', async () => {
    const { ticket } = await issueRunTicket(secret, 397, nowMs)
    await expect(verifyRunTicket(ticket, secret, nowMs + RUN_TICKET_TTL_MS)).rejects
      .toMatchObject({ code: 'ticket_expired' })
  })

  it('fails closed when the dedicated secret is missing', async () => {
    await expect(issueRunTicket(undefined, 397, nowMs)).rejects
      .toBeInstanceOf(RunTicketError)
    const { ticket } = await issueRunTicket(secret, 397, nowMs)
    await expect(verifyRunTicket(ticket, undefined, nowMs)).rejects
      .toMatchObject({ code: 'ticket_configuration_error' })
  })
})
