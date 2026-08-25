import { toValidMetric } from './measurementValidation'

export type LoadedLatencyLevel = 'good' | 'notice' | 'poor' | 'unknown'

export interface LoadedLatencyDirectionResult {
  loadedLatencyMs: number | null
  increaseMs: number | null
  level: LoadedLatencyLevel
}

export interface LoadedLatencyEvaluationResult {
  download: LoadedLatencyDirectionResult
  upload: LoadedLatencyDirectionResult
  overall: LoadedLatencyLevel
  isPartial: boolean
}

export interface LoadedLatencyEvaluationInput {
  idleLatencyMs?: unknown
  downloadLoadedLatencyMs?: unknown
  uploadLoadedLatencyMs?: unknown
}

const unknownDirection = (loadedLatencyMs: number | null): LoadedLatencyDirectionResult => ({
  loadedLatencyMs,
  increaseMs: null,
  level: 'unknown',
})

const levelForIncrease = (increaseMs: number): LoadedLatencyLevel => {
  if (increaseMs <= 20) return 'good'
  if (increaseMs <= 100) return 'notice'
  return 'poor'
}

const evaluateDirection = (
  idleLatencyMs: number | null,
  loadedLatencyMs: unknown,
): LoadedLatencyDirectionResult => {
  const loaded = toValidMetric(loadedLatencyMs)
  if (loaded === null || idleLatencyMs === null) return unknownDirection(loaded)

  const increaseMs = Math.max(0, loaded - idleLatencyMs)
  return {
    loadedLatencyMs: loaded,
    increaseMs,
    level: levelForIncrease(increaseMs),
  }
}

const levelRank: Record<Exclude<LoadedLatencyLevel, 'unknown'>, number> = {
  good: 0,
  notice: 1,
  poor: 2,
}

const worstAvailableLevel = (
  download: LoadedLatencyDirectionResult,
  upload: LoadedLatencyDirectionResult,
): LoadedLatencyLevel => {
  const levels = [download.level, upload.level].filter(
    (level): level is Exclude<LoadedLatencyLevel, 'unknown'> => level !== 'unknown',
  )
  if (levels.length === 0) return 'unknown'
  return levels.reduce((worst, level) => levelRank[level] > levelRank[worst] ? level : worst)
}

export const evaluateLoadedLatencyResponsiveness = (
  input: LoadedLatencyEvaluationInput,
): LoadedLatencyEvaluationResult => {
  const idleLatencyMs = toValidMetric(input.idleLatencyMs)
  const download = evaluateDirection(idleLatencyMs, input.downloadLoadedLatencyMs)
  const upload = evaluateDirection(idleLatencyMs, input.uploadLoadedLatencyMs)

  return {
    download,
    upload,
    overall: worstAvailableLevel(download, upload),
    isPartial: idleLatencyMs !== null && (download.level === 'unknown') !== (upload.level === 'unknown'),
  }
}
