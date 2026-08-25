import type { SpeedMeasurementResult } from '../types/measurement'
import type { SpeedTestMetrics } from '../types/speedTest'
import {
  bandwidthBitsToMbps,
  isSpeedValueInDisplayRange,
} from './speedValue'

export const toValidMetric = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null

export const MAX_CONDITION_LABEL_LENGTH = 24

export const normalizeConditionLabel = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const label = value.trim()
  if (label.length === 0 || Array.from(label).length > MAX_CONDITION_LABEL_LENGTH) return null
  return label
}

export interface CreateMeasurementResultOptions {
  conditionLabel?: string | null
}

const createMeasurementId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const createMeasurementResult = (
  metrics: SpeedTestMetrics,
  measuredAt = new Date(),
  options?: CreateMeasurementResultOptions,
): SpeedMeasurementResult | null => {
  const download = bandwidthBitsToMbps(metrics.download)
  const upload = bandwidthBitsToMbps(metrics.upload)
  const ping = toValidMetric(metrics.latency)
  const conditionLabel = normalizeConditionLabel(options?.conditionLabel)

  if (download === null || upload === null) return null

  return {
    id: createMeasurementId(),
    measuredAt: measuredAt.toISOString(),
    downloadMbps: download,
    uploadMbps: upload,
    pingMs: ping,
    conditionLabel,
  }
}

const isOptionalConditionLabel = (value: unknown): boolean =>
  value === undefined
  || value === null
  || (typeof value === 'string' && normalizeConditionLabel(value) === value)

export const isValidMeasurementResult = (
  value: unknown,
): value is SpeedMeasurementResult => {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<SpeedMeasurementResult>

  return (
    typeof result.id === 'string' &&
    result.id.length > 0 &&
    typeof result.measuredAt === 'string' &&
    !Number.isNaN(Date.parse(result.measuredAt)) &&
    isSpeedValueInDisplayRange(result.downloadMbps) &&
    isSpeedValueInDisplayRange(result.uploadMbps) &&
    (result.pingMs === null || toValidMetric(result.pingMs) !== null) &&
    isOptionalConditionLabel(result.conditionLabel)
  )
}
