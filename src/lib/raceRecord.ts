import type { SpeedMeasurementResult } from '../types/measurement'
import { loadMeasurements } from './measurementStorage'

/**
 * Browser-local race record: lifetime start count, personal best, and the ranking entries this
 * browser joined (so the final rank of a past day can be looked up later). Nothing here is sent
 * anywhere except the measurement id of a past ranking entry, which the server already holds.
 */
export const RACE_RECORD_STORAGE_KEY = 'speed-checker:race-record:v1'
export const MAX_RANKING_STARTS = 30
/** Ranking entries are kept 31 days server-side; older ones cannot be looked up. */
export const RANKING_LOOKUP_DAYS = 30

export interface RankingPlacing {
  rank: number
  tieCount: number
  totalRuns: number
}

export interface RankingStart {
  measurementId: string
  /** JST day (YYYY-MM-DD) of the ranking the entry joined. */
  rankingDay: string
  scoreTenths: number
  /** Placing when the entry was accepted; later runs can push it down. */
  atEntry: RankingPlacing
  /** Placing after the day ended; null until looked up. */
  final: RankingPlacing | null
}

export interface RaceRecord {
  starts: number
  bestDownloadMbps: number | null
  rankingStartCount: number
  bestFinal: (RankingPlacing & { rankingDay: string }) | null
  rankingStarts: RankingStart[]
  lastMeasurementId: string | null
  lastWasBestDownload: boolean
}

const EMPTY_RECORD: RaceRecord = {
  starts: 0,
  bestDownloadMbps: null,
  rankingStartCount: 0,
  bestFinal: null,
  rankingStarts: [],
  lastMeasurementId: null,
  lastWasBestDownload: false,
}

const getBrowserStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u

export const jstDay = (nowMs: number): string =>
  new Date(nowMs + JST_OFFSET_MS).toISOString().slice(0, 10)

export const addDays = (day: string, days: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

const isPositiveCount = (value: unknown): value is number => isCount(value) && value > 0

const parsePlacing = (value: unknown): RankingPlacing | null => {
  if (!isRecord(value)
    || !isPositiveCount(value.rank)
    || !isPositiveCount(value.tieCount)
    || !isPositiveCount(value.totalRuns)
    || value.rank > value.totalRuns) {
    return null
  }
  return { rank: value.rank, tieCount: value.tieCount, totalRuns: value.totalRuns }
}

const parseStart = (value: unknown): RankingStart | null => {
  if (!isRecord(value)
    || typeof value.measurementId !== 'string'
    || value.measurementId.length === 0
    || value.measurementId.length > 128
    || typeof value.rankingDay !== 'string'
    || !DAY_PATTERN.test(value.rankingDay)
    || !isCount(value.scoreTenths)) {
    return null
  }
  const atEntry = parsePlacing(value.atEntry)
  if (!atEntry) return null
  return {
    measurementId: value.measurementId,
    rankingDay: value.rankingDay,
    scoreTenths: value.scoreTenths,
    atEntry,
    final: value.final === null ? null : parsePlacing(value.final),
  }
}

const deriveFromHistory = (storage: Storage | null, excludeId: string | null = null): RaceRecord => {
  const history = loadMeasurements(storage).filter((item) => item.id !== excludeId)
  if (history.length === 0) return { ...EMPTY_RECORD }
  return {
    ...EMPTY_RECORD,
    starts: history.length,
    bestDownloadMbps: Math.max(...history.map((item) => item.downloadMbps)),
  }
}

const hasStoredRecord = (storage: Storage | null): boolean => {
  try {
    return storage?.getItem(RACE_RECORD_STORAGE_KEY) != null
  } catch {
    return false
  }
}

export const loadRaceRecord = (storage: Storage | null = getBrowserStorage()): RaceRecord => {
  if (!storage) return { ...EMPTY_RECORD }
  try {
    const raw = storage.getItem(RACE_RECORD_STORAGE_KEY)
    if (!raw) return deriveFromHistory(storage)
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || !isCount(value.starts)) return deriveFromHistory(storage)
    const bestFinal = parsePlacing(value.bestFinal)
    const bestFinalDay = isRecord(value.bestFinal) && typeof value.bestFinal.rankingDay === 'string'
      && DAY_PATTERN.test(value.bestFinal.rankingDay)
      ? value.bestFinal.rankingDay
      : null
    return {
      starts: value.starts,
      bestDownloadMbps: typeof value.bestDownloadMbps === 'number'
        && Number.isFinite(value.bestDownloadMbps) && value.bestDownloadMbps > 0
        ? value.bestDownloadMbps
        : null,
      rankingStartCount: isCount(value.rankingStartCount) ? value.rankingStartCount : 0,
      bestFinal: bestFinal && bestFinalDay ? { ...bestFinal, rankingDay: bestFinalDay } : null,
      rankingStarts: Array.isArray(value.rankingStarts)
        ? value.rankingStarts.map(parseStart).filter((item): item is RankingStart => item !== null)
          .slice(0, MAX_RANKING_STARTS)
        : [],
      lastMeasurementId: typeof value.lastMeasurementId === 'string' ? value.lastMeasurementId : null,
      lastWasBestDownload: value.lastWasBestDownload === true,
    }
  } catch {
    return { ...EMPTY_RECORD }
  }
}

const saveRaceRecord = (record: RaceRecord, storage: Storage | null): void => {
  if (!storage) return
  try {
    storage.setItem(RACE_RECORD_STORAGE_KEY, JSON.stringify(record))
  } catch {
    // Storage full or blocked: the record is a convenience and must not break measurement.
  }
}

/**
 * Counts one completed measurement. Repeated calls for the same id (React re-renders) return the
 * stored outcome instead of counting twice. A personal best needs an earlier best to beat.
 */
export const recordMeasurement = (
  result: SpeedMeasurementResult,
  storage: Storage | null = getBrowserStorage(),
): { record: RaceRecord, isNewBestDownload: boolean } => {
  const current = loadRaceRecord(storage)
  if (current.lastMeasurementId === result.id) {
    return { record: current, isNewBestDownload: current.lastWasBestDownload }
  }
  // Before the first write the record is derived from history, which may already hold this result.
  const base = hasStoredRecord(storage) ? current : deriveFromHistory(storage, result.id)
  const previousBest = base.bestDownloadMbps
  const isNewBestDownload = previousBest !== null && result.downloadMbps > previousBest
  const record: RaceRecord = {
    ...current,
    starts: base.starts + 1,
    bestDownloadMbps: previousBest === null ? result.downloadMbps : Math.max(previousBest, result.downloadMbps),
    lastMeasurementId: result.id,
    lastWasBestDownload: isNewBestDownload,
  }
  saveRaceRecord(record, storage)
  return { record, isNewBestDownload }
}

export const recordRankingStart = (
  start: Omit<RankingStart, 'final'>,
  storage: Storage | null = getBrowserStorage(),
): RaceRecord => {
  const current = loadRaceRecord(storage)
  if (current.rankingStarts.some((item) => item.measurementId === start.measurementId)) return current
  const record: RaceRecord = {
    ...current,
    rankingStartCount: current.rankingStartCount + 1,
    rankingStarts: [{ ...start, final: null }, ...current.rankingStarts].slice(0, MAX_RANKING_STARTS),
  }
  saveRaceRecord(record, storage)
  return record
}

const isBetterPlacing = (next: RankingPlacing, best: RankingPlacing | null): boolean =>
  best === null || next.rank < best.rank || (next.rank === best.rank && next.totalRuns > best.totalRuns)

/** Stores a looked-up final placing; `null` drops an entry the server no longer has. */
export const recordFinalPlacing = (
  measurementId: string,
  outcome: { rankingDay: string, placing: RankingPlacing } | null,
  storage: Storage | null = getBrowserStorage(),
): RaceRecord => {
  const current = loadRaceRecord(storage)
  let bestFinal = current.bestFinal
  const rankingStarts = current.rankingStarts.flatMap((item) => {
    if (item.measurementId !== measurementId) return [item]
    if (outcome === null) return []
    if (isBetterPlacing(outcome.placing, bestFinal)) {
      bestFinal = { ...outcome.placing, rankingDay: outcome.rankingDay }
    }
    return [{ ...item, rankingDay: outcome.rankingDay, final: outcome.placing }]
  })
  const record: RaceRecord = { ...current, rankingStarts, bestFinal }
  saveRaceRecord(record, storage)
  return record
}

/** Entries of the latest finished day that still need their final placing, at most three. */
export const getPendingFinalLookups = (record: RaceRecord, today: string): RankingStart[] => {
  const oldestLookupDay = addDays(today, -RANKING_LOOKUP_DAYS)
  const pending = record.rankingStarts.filter((item) =>
    item.final === null && item.rankingDay < today && item.rankingDay >= oldestLookupDay)
  const latestDay = pending.reduce<string | null>(
    (latest, item) => (latest === null || item.rankingDay > latest ? item.rankingDay : latest),
    null,
  )
  return pending.filter((item) => item.rankingDay === latestDay).slice(0, 3)
}

export type LatestRankingSummary =
  | { kind: 'final', rankingDay: string, placing: RankingPlacing }
  | { kind: 'today', placing: RankingPlacing }

/**
 * The best placing of the most recent ranking day this browser joined: today's entry placing while
 * the day runs, otherwise the final placing of the latest finished day (if known).
 */
export const getLatestRankingSummary = (record: RaceRecord, today: string): LatestRankingSummary | null => {
  const todays = record.rankingStarts.filter((item) => item.rankingDay === today)
  if (todays.length > 0) {
    const best = todays.map((item) => item.atEntry).reduce((a, b) => (isBetterPlacing(b, a) ? b : a))
    return { kind: 'today', placing: best }
  }
  const finished = record.rankingStarts.filter((item) => item.rankingDay < today && item.final !== null)
  if (finished.length === 0) return null
  const latestDay = finished.reduce((latest, item) => (item.rankingDay > latest ? item.rankingDay : latest), finished[0].rankingDay)
  const best = finished.filter((item) => item.rankingDay === latestDay)
    .map((item) => item.final as RankingPlacing)
    .reduce((a, b) => (isBetterPlacing(b, a) ? b : a))
  return { kind: 'final', rankingDay: latestDay, placing: best }
}

export const clearRaceRecord = (storage: Storage | null = getBrowserStorage()): void => {
  if (!storage) return
  try {
    storage.removeItem(RACE_RECORD_STORAGE_KEY)
  } catch {
    // ignore
  }
}
