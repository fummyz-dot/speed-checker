import type { SpeedMeasurementResult } from '../types/measurement'
import {
  isValidMeasurementResult,
  normalizeConditionLabel,
  toValidMetric,
  toValidTimezoneOffsetMinutes,
} from './measurementValidation'

export const MEASUREMENT_STORAGE_KEY = 'speed-checker:measurements:v1'
export const MAX_MEASUREMENT_HISTORY = 30
export const MAX_RECENT_CONDITION_LABELS = 5

const getBrowserStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

const normalizeStoredMeasurement = (value: unknown): SpeedMeasurementResult | null => {
  if (!value || typeof value !== 'object') return null
  const result = value as Partial<SpeedMeasurementResult>
  const baseResult = {
    id: result.id,
    measuredAt: result.measuredAt,
    downloadMbps: result.downloadMbps,
    uploadMbps: result.uploadMbps,
    pingMs: result.pingMs,
  }

  if (!isValidMeasurementResult(baseResult)) return null

  const normalized: SpeedMeasurementResult = { ...baseResult }
  if (result.jitterMs !== undefined) normalized.jitterMs = toValidMetric(result.jitterMs)
  if (result.downloadLoadedLatencyMs !== undefined) {
    normalized.downloadLoadedLatencyMs = toValidMetric(result.downloadLoadedLatencyMs)
  }
  if (result.uploadLoadedLatencyMs !== undefined) {
    normalized.uploadLoadedLatencyMs = toValidMetric(result.uploadLoadedLatencyMs)
  }
  if (result.timezoneOffsetMinutes !== undefined) {
    normalized.timezoneOffsetMinutes = toValidTimezoneOffsetMinutes(result.timezoneOffsetMinutes)
  }
  if (result.conditionLabel !== undefined) {
    normalized.conditionLabel = normalizeConditionLabel(result.conditionLabel)
  }
  return normalized
}

export const loadMeasurements = (
  storage: Storage | null = getBrowserStorage(),
): SpeedMeasurementResult[] => {
  if (!storage) return []

  try {
    const raw = storage.getItem(MEASUREMENT_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeStoredMeasurement)
      .filter((result): result is SpeedMeasurementResult => result !== null)
      .slice(0, MAX_MEASUREMENT_HISTORY)
  } catch {
    return []
  }
}

export const saveMeasurement = (
  result: SpeedMeasurementResult,
  storage: Storage | null = getBrowserStorage(),
): SpeedMeasurementResult[] => {
  const normalizedResult = normalizeStoredMeasurement(result)
  if (!storage || !normalizedResult) return loadMeasurements(storage)

  const existing = loadMeasurements(storage)
  if (existing.some((item) => item.id === normalizedResult.id)) return existing

  const updated = [normalizedResult, ...existing].slice(0, MAX_MEASUREMENT_HISTORY)
  try {
    storage.setItem(MEASUREMENT_STORAGE_KEY, JSON.stringify(updated))
    return updated
  } catch {
    return existing
  }
}

export const clearMeasurements = (
  storage: Storage | null = getBrowserStorage(),
): boolean => {
  if (!storage) return false
  try {
    storage.removeItem(MEASUREMENT_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export const getRecentConditionLabels = (
  history: readonly SpeedMeasurementResult[],
): string[] => {
  const labels = new Set<string>()

  for (const measurement of history) {
    const label = normalizeConditionLabel(measurement.conditionLabel)
    if (!label || labels.has(label)) continue

    labels.add(label)
    if (labels.size === MAX_RECENT_CONDITION_LABELS) break
  }

  return [...labels]
}

export interface MetricComparison {
  difference: number | null
  percentage: number | null
  direction: 'up' | 'down' | 'same' | 'unknown'
}

export interface MeasurementComparison {
  download: MetricComparison
  upload: MetricComparison
  ping: MetricComparison
}

const compareMetric = (
  current: number | null,
  previous: number | null,
  sameTolerance: number,
): MetricComparison => {
  if (current === null || previous === null) {
    return { difference: null, percentage: null, direction: 'unknown' }
  }
  const difference = current - previous
  const direction = Math.abs(difference) < sameTolerance
    ? 'same'
    : difference > 0 ? 'up' : 'down'
  return {
    difference,
    percentage: previous === 0 ? null : (difference / previous) * 100,
    direction,
  }
}

export const compareMeasurements = (
  current: SpeedMeasurementResult,
  previous: SpeedMeasurementResult,
): MeasurementComparison => ({
  download: compareMetric(current.downloadMbps, previous.downloadMbps, 0.1),
  upload: compareMetric(current.uploadMbps, previous.uploadMbps, 0.1),
  ping: compareMetric(current.pingMs, previous.pingMs, 1),
})
