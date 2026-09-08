import {
  RUN_TIME_MAPPING_VERSION,
  RUN_TIME_MAX_TENTHS,
  RUN_TIME_MIN_TENTHS,
} from './runTimeMapping'

export const RUN_TICKET_VERSION = 1
export const RUN_TICKET_PURPOSE = 'net-speed-run'
export const RUN_TICKET_SCORE_VERSION = 1
export const RUN_TICKET_TTL_MS = 30 * 60 * 1000

const RUN_TICKET_MAX_LENGTH = 2048
const NONCE_BYTE_LENGTH = 32
const encoder = new TextEncoder()

export interface RunTicketPayload {
  version: 1
  purpose: 'net-speed-run'
  scoreVersion: 1
  mappingVersion: 1
  runTimeTenths: number
  issuedAtMs: number
  expiresAtMs: number
  nonce: string
}

export type RunTicketErrorCode =
  | 'ticket_invalid'
  | 'ticket_expired'
  | 'ticket_configuration_error'

export class RunTicketError extends Error {
  constructor(public readonly code: RunTicketErrorCode) {
    super(code)
  }
}

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

const fromBase64Url = (value: string): Uint8Array => {
  if (!/^[A-Za-z0-9_-]+$/u.test(value) || value.length % 4 === 1) {
    throw new RunTicketError('ticket_invalid')
  }

  try {
    const padded = value.replaceAll('-', '+').replaceAll('_', '/')
      + '='.repeat((4 - (value.length % 4)) % 4)
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
    if (toBase64Url(bytes) !== value) throw new RunTicketError('ticket_invalid')
    return bytes
  } catch (error) {
    if (error instanceof RunTicketError) throw error
    throw new RunTicketError('ticket_invalid')
  }
}

const importHmacKey = (secret: string, usages: ('sign' | 'verify')[]): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages,
  )

const requireSecret = (secret: string | undefined): string => {
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new RunTicketError('ticket_configuration_error')
  }
  return secret
}

const createNonce = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(NONCE_BYTE_LENGTH))
  return toBase64Url(bytes)
}

const isExactObject = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const valueKeys = Object.keys(value)
  return valueKeys.length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

const hasValidNonce = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(value)) return false
  try {
    return fromBase64Url(value).byteLength === NONCE_BYTE_LENGTH
  } catch {
    return false
  }
}

const isRunTicketPayload = (value: unknown): value is RunTicketPayload => {
  if (!isExactObject(value, [
    'version', 'purpose', 'scoreVersion', 'mappingVersion',
    'runTimeTenths', 'issuedAtMs', 'expiresAtMs', 'nonce',
  ])) return false

  return value.version === RUN_TICKET_VERSION
    && value.purpose === RUN_TICKET_PURPOSE
    && value.scoreVersion === RUN_TICKET_SCORE_VERSION
    && value.mappingVersion === RUN_TIME_MAPPING_VERSION
    && typeof value.runTimeTenths === 'number'
    && Number.isInteger(value.runTimeTenths)
    && value.runTimeTenths >= RUN_TIME_MIN_TENTHS
    && value.runTimeTenths <= RUN_TIME_MAX_TENTHS
    && Number.isSafeInteger(value.issuedAtMs)
    && Number.isSafeInteger(value.expiresAtMs)
    && hasValidNonce(value.nonce)
}

export const issueRunTicket = async (
  secret: string | undefined,
  runTimeTenths: number,
  nowMs = Date.now(),
): Promise<{ ticket: string; payload: RunTicketPayload }> => {
  const hmacSecret = requireSecret(secret)
  if (!Number.isInteger(runTimeTenths)
    || runTimeTenths < RUN_TIME_MIN_TENTHS
    || runTimeTenths > RUN_TIME_MAX_TENTHS
    || !Number.isSafeInteger(nowMs)) {
    throw new RunTicketError('ticket_configuration_error')
  }

  const expiresAtMs = nowMs + RUN_TICKET_TTL_MS
  if (!Number.isSafeInteger(expiresAtMs)) {
    throw new RunTicketError('ticket_configuration_error')
  }

  const payload: RunTicketPayload = {
    version: RUN_TICKET_VERSION,
    purpose: RUN_TICKET_PURPOSE,
    scoreVersion: RUN_TICKET_SCORE_VERSION,
    mappingVersion: RUN_TIME_MAPPING_VERSION,
    runTimeTenths,
    issuedAtMs: nowMs,
    expiresAtMs,
    nonce: createNonce(),
  }
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const key = await importHmacKey(hmacSecret, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(encodedPayload)))
  return { ticket: `${encodedPayload}.${toBase64Url(signature)}`, payload }
}

export const verifyRunTicket = async (
  ticket: string,
  secret: string | undefined,
  nowMs = Date.now(),
): Promise<RunTicketPayload> => {
  const hmacSecret = requireSecret(secret)
  if (!Number.isSafeInteger(nowMs)
    || typeof ticket !== 'string'
    || ticket.length === 0
    || ticket.length > RUN_TICKET_MAX_LENGTH) {
    throw new RunTicketError('ticket_invalid')
  }

  const parts = ticket.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new RunTicketError('ticket_invalid')
  }

  const signature = fromBase64Url(parts[1])
  if (signature.byteLength !== 32) throw new RunTicketError('ticket_invalid')

  try {
    const key = await importHmacKey(hmacSecret, ['verify'])
    const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(parts[0]))
    if (!valid) throw new RunTicketError('ticket_invalid')
  } catch (error) {
    if (error instanceof RunTicketError) throw error
    throw new RunTicketError('ticket_invalid')
  }

  let payload: unknown
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0])))
  } catch {
    throw new RunTicketError('ticket_invalid')
  }

  if (!isRunTicketPayload(payload)) throw new RunTicketError('ticket_invalid')
  if (payload.expiresAtMs - payload.issuedAtMs !== RUN_TICKET_TTL_MS
    || payload.issuedAtMs > nowMs) {
    throw new RunTicketError('ticket_invalid')
  }
  if (payload.expiresAtMs <= nowMs) throw new RunTicketError('ticket_expired')
  return payload
}
