import { evaluateLoadedLatencyResponsiveness } from './loadedLatencyEvaluation'
import { normalizeConditionLabel, toValidMetric } from './measurementValidation'
import type { SpeedMeasurementResult } from '../types/measurement'

export const RECENT_TREND_LIMIT = 12
export const MAX_CONDITION_TREND_SUMMARIES = 5

export type TimeBandId = 'morning' | 'daytime' | 'evening' | 'lateNight'

export interface TimeBandDefinition {
  id: TimeBandId
  label: '朝' | '昼' | '夜' | '深夜'
}

export const TIME_BANDS: readonly TimeBandDefinition[] = [
  { id: 'morning', label: '朝' },
  { id: 'daytime', label: '昼' },
  { id: 'evening', label: '夜' },
  { id: 'lateNight', label: '深夜' },
]

export interface MeasurementTrendPoint {
  id: string
  measuredAt: string
  downloadMbps: number
  uploadMbps: number
  pingMs: number | null
  loadedLatencyIncreaseMs: number | null
}

export interface MetricSummary {
  median: number | null
  sampleCount: number
  quality: 'none' | 'reference' | 'trend'
}

export interface ConditionSummary {
  conditionLabel: string
  totalMeasurements: number
  latestMeasuredAt: string
  downloadMbps: MetricSummary
  uploadMbps: MetricSummary
  pingMs: MetricSummary
  loadedLatencyIncreaseMs: MetricSummary
}

export interface ConditionTrendAnalysis {
  summaries: ConditionSummary[]
  labeledMeasurementCount: number
  totalConditionCount: number
  hasMoreConditions: boolean
}

export interface TimeBandSummary extends TimeBandDefinition {
  measurementCount: number
  downloadMbps: MetricSummary
  uploadMbps: MetricSummary
  pingMs: MetricSummary
  loadedLatencyIncreaseMs: MetricSummary
}

export interface TimeBandMeasurement {
  measurement: SpeedMeasurementResult
  timezoneOffsetMinutes: number
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export const getSampleQuality = (sampleCount: number): MetricSummary['quality'] =>
  sampleCount === 0 ? 'none' : sampleCount < 3 ? 'reference' : 'trend'

export const summarizeMetric = (values: readonly number[]): MetricSummary => {
  const validValues = values.filter(isFiniteNumber)
  const sampleCount = validValues.length
  return {
    median: median(validValues),
    sampleCount,
    quality: getSampleQuality(sampleCount),
  }
}

export const median = (values: readonly number[]): number | null => {
  const sorted = values.filter(isFiniteNumber).sort((left, right) => left - right)
  if (sorted.length === 0) return null

  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

export const getLoadedLatencyIncreaseMs = (
  measurement: Pick<
    SpeedMeasurementResult,
    'pingMs' | 'downloadLoadedLatencyMs' | 'uploadLoadedLatencyMs'
  >,
): number | null => {
  const evaluation = evaluateLoadedLatencyResponsiveness({
    idleLatencyMs: measurement.pingMs,
    downloadLoadedLatencyMs: measurement.downloadLoadedLatencyMs,
    uploadLoadedLatencyMs: measurement.uploadLoadedLatencyMs,
  })
  const increases = [evaluation.download.increaseMs, evaluation.upload.increaseMs]
    .filter((increase): increase is number => increase !== null)

  return increases.length > 0 ? Math.max(...increases) : null
}

export const getRecentMeasurementTrend = (
  measurements: readonly SpeedMeasurementResult[],
): MeasurementTrendPoint[] => measurements
  .slice(0, RECENT_TREND_LIMIT)
  .reverse()
  .map((measurement) => ({
    id: measurement.id,
    measuredAt: measurement.measuredAt,
    downloadMbps: measurement.downloadMbps,
    uploadMbps: measurement.uploadMbps,
    pingMs: measurement.pingMs,
    loadedLatencyIncreaseMs: getLoadedLatencyIncreaseMs(measurement),
  }))

export const classifyTimeBand = (
  measuredAt: unknown,
  timezoneOffsetMinutes: unknown,
): TimeBandId | null => {
  if (
    typeof measuredAt !== 'string'
    || !isFiniteNumber(timezoneOffsetMinutes)
    || timezoneOffsetMinutes < -840
    || timezoneOffsetMinutes > 840
  ) return null

  const measuredAtMs = Date.parse(measuredAt)
  if (Number.isNaN(measuredAtMs)) return null

  const localHour = new Date(measuredAtMs - timezoneOffsetMinutes * 60_000).getUTCHours()
  if (localHour >= 5 && localHour < 11) return 'morning'
  if (localHour >= 11 && localHour < 17) return 'daytime'
  if (localHour >= 17 && localHour < 23) return 'evening'
  return 'lateNight'
}

const emptySummary = (): TimeBandSummary => ({
  id: 'morning',
  label: '朝',
  measurementCount: 0,
  downloadMbps: summarizeMetric([]),
  uploadMbps: summarizeMetric([]),
  pingMs: summarizeMetric([]),
  loadedLatencyIncreaseMs: summarizeMetric([]),
})

export const summarizeMeasurementsByTimeBand = (
  entries: readonly TimeBandMeasurement[],
): TimeBandSummary[] => {
  const valuesByBand = new Map<TimeBandId, {
    measurementCount: number
    downloadMbps: number[]
    uploadMbps: number[]
    pingMs: number[]
    loadedLatencyIncreaseMs: number[]
  }>(TIME_BANDS.map(({ id }) => [id, {
    measurementCount: 0,
    downloadMbps: [],
    uploadMbps: [],
    pingMs: [],
    loadedLatencyIncreaseMs: [],
  }]))

  entries.forEach(({ measurement, timezoneOffsetMinutes }) => {
    const timeBand = classifyTimeBand(measurement.measuredAt, timezoneOffsetMinutes)
    if (timeBand === null) return

    const values = valuesByBand.get(timeBand)
    if (!values) return
    values.measurementCount += 1

    const download = toValidMetric(measurement.downloadMbps)
    const upload = toValidMetric(measurement.uploadMbps)
    const ping = toValidMetric(measurement.pingMs)
    const loadedLatencyIncrease = getLoadedLatencyIncreaseMs(measurement)
    if (download !== null) values.downloadMbps.push(download)
    if (upload !== null) values.uploadMbps.push(upload)
    if (ping !== null) values.pingMs.push(ping)
    if (loadedLatencyIncrease !== null) values.loadedLatencyIncreaseMs.push(loadedLatencyIncrease)
  })

  return TIME_BANDS.map(({ id, label }) => {
    const values = valuesByBand.get(id)
    if (!values) return { ...emptySummary(), id, label }
    return {
      id,
      label,
      measurementCount: values.measurementCount,
      downloadMbps: summarizeMetric(values.downloadMbps),
      uploadMbps: summarizeMetric(values.uploadMbps),
      pingMs: summarizeMetric(values.pingMs),
      loadedLatencyIncreaseMs: summarizeMetric(values.loadedLatencyIncreaseMs),
    }
  })
}

interface ConditionValues {
  conditionLabel: string
  totalMeasurements: number
  latestMeasuredAt: string
  latestMeasuredAtMs: number
  latestIndex: number
  downloadMbps: number[]
  uploadMbps: number[]
  pingMs: number[]
  loadedLatencyIncreaseMs: number[]
}

const measuredAtTimestamp = (measuredAt: string): number => {
  const timestamp = Date.parse(measuredAt)
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp
}

export const summarizeMeasurementsByCondition = (
  measurements: readonly SpeedMeasurementResult[],
): ConditionTrendAnalysis => {
  const valuesByCondition = new Map<string, ConditionValues>()
  let labeledMeasurementCount = 0

  measurements.forEach((measurement, index) => {
    const conditionLabel = normalizeConditionLabel(measurement.conditionLabel)
    if (conditionLabel === null) return

    labeledMeasurementCount += 1
    const measuredAtMs = measuredAtTimestamp(measurement.measuredAt)
    const existing = valuesByCondition.get(conditionLabel)
    const values = existing ?? {
      conditionLabel,
      totalMeasurements: 0,
      latestMeasuredAt: measurement.measuredAt,
      latestMeasuredAtMs: measuredAtMs,
      latestIndex: index,
      downloadMbps: [],
      uploadMbps: [],
      pingMs: [],
      loadedLatencyIncreaseMs: [],
    }

    values.totalMeasurements += 1
    if (measuredAtMs > values.latestMeasuredAtMs || (
      measuredAtMs === values.latestMeasuredAtMs && index < values.latestIndex
    )) {
      values.latestMeasuredAt = measurement.measuredAt
      values.latestMeasuredAtMs = measuredAtMs
      values.latestIndex = index
    }

    const download = toValidMetric(measurement.downloadMbps)
    const upload = toValidMetric(measurement.uploadMbps)
    const ping = toValidMetric(measurement.pingMs)
    const loadedLatencyIncrease = getLoadedLatencyIncreaseMs(measurement)
    if (download !== null) values.downloadMbps.push(download)
    if (upload !== null) values.uploadMbps.push(upload)
    if (ping !== null) values.pingMs.push(ping)
    if (loadedLatencyIncrease !== null) values.loadedLatencyIncreaseMs.push(loadedLatencyIncrease)

    valuesByCondition.set(conditionLabel, values)
  })

  const allSummaries = [...valuesByCondition.values()]
    .sort((left, right) => right.latestMeasuredAtMs - left.latestMeasuredAtMs || left.latestIndex - right.latestIndex)
    .map((values): ConditionSummary => ({
      conditionLabel: values.conditionLabel,
      totalMeasurements: values.totalMeasurements,
      latestMeasuredAt: values.latestMeasuredAt,
      downloadMbps: summarizeMetric(values.downloadMbps),
      uploadMbps: summarizeMetric(values.uploadMbps),
      pingMs: summarizeMetric(values.pingMs),
      loadedLatencyIncreaseMs: summarizeMetric(values.loadedLatencyIncreaseMs),
    }))

  return {
    summaries: allSummaries.slice(0, MAX_CONDITION_TREND_SUMMARIES),
    labeledMeasurementCount,
    totalConditionCount: allSummaries.length,
    hasMoreConditions: allSummaries.length > MAX_CONDITION_TREND_SUMMARIES,
  }
}
