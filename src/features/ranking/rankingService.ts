import type { SpeedMeasurementResult } from '../../types/measurement'
import type { RaceChampionReference } from '../../types/raceChampion'
import type { RankingContext, RankingService, RankingSubmissionResult } from './types'

const CONTEXT_TIMEOUT_MS = 1000
const SUBMISSION_TIMEOUT_MS = 8000

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isNullableString = (value: unknown): value is string | null =>
  typeof value === 'string' || value === null

const isNullableFiniteNumber = (value: unknown): value is number | null =>
  value === null || isFiniteNumber(value)

const parseChampion = (value: unknown): RaceChampionReference => {
  if (!isRecord(value)
    || (value.source !== 'previous_day_winner' && value.source !== 'fallback')
    || !isNullableString(value.sourceDay)
    || !isNullableFiniteNumber(value.scoreTenths)
    || !isFiniteNumber(value.downloadTenths)
    || !isFiniteNumber(value.uploadTenths)
    || !isFiniteNumber(value.qualifyingRuns)) {
    throw new Error('Invalid ranking champion response')
  }

  return {
    source: value.source,
    sourceDay: value.sourceDay,
    scoreTenths: value.scoreTenths,
    downloadMbps: value.downloadTenths / 10,
    uploadMbps: value.uploadTenths / 10,
    qualifyingRuns: value.qualifyingRuns,
  }
}

const parseContext = (value: unknown): RankingContext => {
  if (!isRecord(value)
    || value.ok !== true
    || typeof value.rankingAvailable !== 'boolean'
    || typeof value.rankingDay !== 'string'
    || !isNullableString(value.ticket)
    || !isNullableFiniteNumber(value.ticketExpiresAtMs)
    || (value.unavailableReason !== undefined && value.unavailableReason !== 'country_not_eligible')) {
    throw new Error('Invalid ranking context response')
  }

  const champion = parseChampion(value.champion)
  return {
    ok: true,
    rankingAvailable: value.rankingAvailable,
    rankingDay: value.rankingDay,
    ticket: value.ticket,
    ticketExpiresAtMs: value.ticketExpiresAtMs,
    ...(value.unavailableReason === 'country_not_eligible'
      ? { unavailableReason: 'country_not_eligible' as const }
      : {}),
    champion,
  }
}

const parseSubmissionChampion = (value: unknown): RaceChampionReference => {
  if (!isRecord(value)
    || (value.source !== 'previous_day_winner' && value.source !== 'fallback')
    || !isNullableString(value.sourceDay)
    || !isNullableFiniteNumber(value.scoreTenths)
    || !isFiniteNumber(value.downloadTenths)
    || !isFiniteNumber(value.uploadTenths)
    || !isFiniteNumber(value.qualifyingRuns)) {
    throw new Error('Invalid ranking submission response')
  }

  return {
    source: value.source,
    sourceDay: value.sourceDay,
    scoreTenths: value.scoreTenths,
    downloadMbps: value.downloadTenths / 10,
    uploadMbps: value.uploadTenths / 10,
    qualifyingRuns: value.qualifyingRuns,
  }
}

const parseSubmission = (value: unknown): RankingSubmissionResult => {
  if (!isRecord(value) || value.ok !== true || !isRecord(value.entry) || !Array.isArray(value.top3)
    || !isFiniteNumber(value.entry.scoreTenths)
    || !isFiniteNumber(value.entry.rank)
    || !isFiniteNumber(value.entry.tieCount)
    || !isFiniteNumber(value.entry.totalRuns)
    || !isNullableFiniteNumber(value.entry.topPercentTenths)
    || !value.top3.every((entry) => isRecord(entry)
      && isFiniteNumber(entry.rank) && isFiniteNumber(entry.scoreTenths))) {
    throw new Error('Invalid ranking submission response')
  }

  return {
    ok: true,
    entry: {
      scoreTenths: value.entry.scoreTenths,
      rank: value.entry.rank,
      tieCount: value.entry.tieCount,
      totalRuns: value.entry.totalRuns,
      topPercentTenths: value.entry.topPercentTenths,
    },
    top3: value.top3.map((entry) => ({
      rank: (entry as Record<string, unknown>).rank as number,
      scoreTenths: (entry as Record<string, unknown>).scoreTenths as number,
    })),
    champion: parseSubmissionChampion(value.champion),
  }
}

const fetchJson = async (url: string, init: RequestInit, timeoutMs: number): Promise<unknown> => {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) throw new Error('Ranking API request failed')
    return await response.json()
  } finally {
    window.clearTimeout(timeout)
  }
}

export const createRankingApiService = (): RankingService => {
  let context: RankingContext | null = null

  return {
    async getContext() {
      const response = await fetchJson('/api/ranking/context', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      }, CONTEXT_TIMEOUT_MS)
      const nextContext = parseContext(response)
      context = nextContext
      return nextContext
    },

    async submitMeasurement(measurement: SpeedMeasurementResult, turnstileToken: string) {
      if (!context?.rankingAvailable || typeof context.ticket !== 'string') {
        throw new Error('Ranking ticket is unavailable')
      }

      const response = await fetchJson('/api/ranking/entries', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticket: context.ticket,
          turnstileToken,
          measurement: {
            id: measurement.id,
            downloadMbps: measurement.downloadMbps,
            uploadMbps: measurement.uploadMbps,
            pingMs: measurement.pingMs,
            jitterMs: measurement.jitterMs,
          },
        }),
      }, SUBMISSION_TIMEOUT_MS)
      return parseSubmission(response)
    },
  }
}
