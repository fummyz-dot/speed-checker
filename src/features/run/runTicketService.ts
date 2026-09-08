import type { SpeedMeasurementResult } from '../../types/measurement'
import type { IssuedRunTicket, RunTicketIssueErrorCode } from './types'

const RUN_TICKET_TIMEOUT_MS = 8000

export class RunTicketIssueError extends Error {
  constructor(public readonly code: RunTicketIssueErrorCode) {
    super(code)
  }
}

const isExactObject = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const valueKeys = Object.keys(value)
  return valueKeys.length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

const knownErrorCode = (value: unknown): RunTicketIssueErrorCode | null => {
  if (value === 'MEASUREMENT_NOT_ELIGIBLE'
    || value === 'SERVICE_UNAVAILABLE'
    || value === 'INVALID_REQUEST') return value
  return null
}

const parseResponse = (value: unknown, responseOk: boolean): IssuedRunTicket => {
  if (responseOk
    && isExactObject(value, ['ok', 'ticket', 'expiresAtMs'])
    && value.ok === true
    && typeof value.ticket === 'string'
    && value.ticket.length > 0
    && typeof value.expiresAtMs === 'number'
    && Number.isSafeInteger(value.expiresAtMs)) {
    return { ok: true, ticket: value.ticket, expiresAtMs: value.expiresAtMs }
  }

  if (isExactObject(value, ['ok', 'code']) && value.ok === false) {
    const code = knownErrorCode(value.code)
    if (code) throw new RunTicketIssueError(code)
  }
  throw new RunTicketIssueError('UNKNOWN')
}

export const isRunMeasurementEligible = (measurement: SpeedMeasurementResult): boolean =>
  measurement.pingMs != null && measurement.jitterMs != null

export const issueRunTicket = async (
  measurement: SpeedMeasurementResult,
): Promise<IssuedRunTicket> => {
  if (!isRunMeasurementEligible(measurement)) {
    throw new RunTicketIssueError('MEASUREMENT_NOT_ELIGIBLE')
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), RUN_TICKET_TIMEOUT_MS)
  try {
    const response = await fetch('/api/run-ticket', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
      body: JSON.stringify({
        measurement: {
          id: measurement.id,
          downloadMbps: measurement.downloadMbps,
          uploadMbps: measurement.uploadMbps,
          pingMs: measurement.pingMs,
          jitterMs: measurement.jitterMs,
        },
      }),
    })
    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new RunTicketIssueError('UNKNOWN')
    }
    return parseResponse(body, response.ok)
  } finally {
    window.clearTimeout(timeout)
  }
}
