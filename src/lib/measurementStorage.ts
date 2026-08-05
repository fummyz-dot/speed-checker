import type { SpeedMeasurementResult } from '../types/measurement'
import { isValidMeasurementResult } from './measurementValidation'

export const MEASUREMENT_STORAGE_KEY = 'speed-checker:measurements:v1'
export const MAX_MEASUREMENT_HISTORY = 30

const getBrowserStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
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
    return parsed.filter(isValidMeasurementResult).slice(0, MAX_MEASUREMENT_HISTORY)
  } catch {
    return []
  }
}

export const saveMeasurement = (
  result: SpeedMeasurementResult,
  storage: Storage | null = getBrowserStorage(),
): SpeedMeasurementResult[] => {
  if (!storage || !isValidMeasurementResult(result)) return loadMeasurements(storage)

  const existing = loadMeasurements(storage)
  if (existing.some((item) => item.id === result.id)) return existing

  const updated = [result, ...existing].slice(0, MAX_MEASUREMENT_HISTORY)
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
