import { useCallback, useEffect, useRef, useState } from 'react'
import SpeedTest, {
  type MeasurementConfig,
  type Results,
} from '@cloudflare/speedtest'
import {
  EMPTY_METRICS,
  type SpeedTestMetrics,
  type TestPhase,
} from '../types/speedTest'
import type { SpeedMeasurementResult } from '../types/measurement'
import {
  createMeasurementResult,
  normalizeConditionLabel,
  toValidMetric,
} from '../lib/measurementValidation'
import { bandwidthBitsToMbps } from '../lib/speedValue'

const measurements: MeasurementConfig[] = [
  { type: 'latency', numPackets: 20 },
  { type: 'download', bytes: 100_000, count: 5, bypassMinDuration: true },
  { type: 'download', bytes: 1_000_000, count: 6 },
  { type: 'download', bytes: 10_000_000, count: 4 },
  { type: 'download', bytes: 25_000_000, count: 2 },
  { type: 'upload', bytes: 100_000, count: 5, bypassMinDuration: true },
  { type: 'upload', bytes: 1_000_000, count: 6 },
  { type: 'upload', bytes: 10_000_000, count: 4 },
  { type: 'upload', bytes: 25_000_000, count: 2 },
]

const readMetrics = (results: Results): SpeedTestMetrics => ({
  download: toValidMetric(results.getDownloadBandwidth()),
  upload: toValidMetric(results.getUploadBandwidth()),
  latency: toValidMetric(results.getUnloadedLatency()),
  jitter: toValidMetric(results.getUnloadedJitter()),
  downloadLoadedLatency: toValidMetric(results.getDownLoadedLatency()),
  uploadLoadedLatency: toValidMetric(results.getUpLoadedLatency()),
})

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return '速度を測定できませんでした。通信状況を確認して、もう一度お試しください。'
}

export interface UseSpeedTestResult {
  metrics: SpeedTestMetrics
  phase: TestPhase
  isRunning: boolean
  error: string | null
  completedResult: SpeedMeasurementResult | null
  confirmedDownloadMbps: number | null
  start: (options?: StartSpeedTestOptions) => void
}

export interface StartSpeedTestOptions {
  conditionLabel?: string | null
}

export const useSpeedTest = (): UseSpeedTestResult => {
  const engineRef = useRef<SpeedTest | null>(null)
  const runIdRef = useRef(0)
  const mountedRef = useRef(true)
  const confirmedDownloadRef = useRef<number | null>(null)
  const runConditionLabelRef = useRef<string | null>(null)
  const [metrics, setMetrics] = useState<SpeedTestMetrics>(EMPTY_METRICS)
  const [phase, setPhase] = useState<TestPhase>('idle')
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completedResult, setCompletedResult] = useState<SpeedMeasurementResult | null>(null)
  const [confirmedDownloadMbps, setConfirmedDownloadMbps] = useState<number | null>(null)

  const stopCurrentTest = useCallback(() => {
    runIdRef.current += 1
    engineRef.current?.pause()
    engineRef.current = null
  }, [])

  const start = useCallback((options?: StartSpeedTestOptions) => {
    stopCurrentTest()

    const runId = runIdRef.current
    runConditionLabelRef.current = normalizeConditionLabel(options?.conditionLabel)
    setMetrics(EMPTY_METRICS)
    setCompletedResult(null)
    confirmedDownloadRef.current = null
    setConfirmedDownloadMbps(null)
    setError(null)
    setPhase('latency')
    setIsRunning(true)

    const isCurrentRun = () => mountedRef.current && runIdRef.current === runId

    try {
      const engine = new SpeedTest({
        autoStart: false,
        measurements,
        measureDownloadLoadedLatency: true,
        measureUploadLoadedLatency: true,
      })
      engineRef.current = engine

      engine.onPhaseChange = ({ measurement }) => {
        if (!isCurrentRun()) return
        if (
          measurement.type === 'latency' ||
          measurement.type === 'download' ||
          measurement.type === 'upload'
        ) {
          if (measurement.type === 'upload') {
            // upload開始時点の確定済みdownload値を、レース開始と同じ描画で渡す。
            const nextMetrics = readMetrics(engine.results)
            setMetrics(nextMetrics)
            if (confirmedDownloadRef.current === null) {
              confirmedDownloadRef.current = bandwidthBitsToMbps(nextMetrics.download)
              setConfirmedDownloadMbps(confirmedDownloadRef.current)
            }
          }
          setPhase(measurement.type)
        }
      }

      engine.onResultsChange = () => {
        if (!isCurrentRun()) return
        setMetrics(readMetrics(engine.results))
      }

      engine.onFinish = (results) => {
        if (!isCurrentRun()) return
        const finalMetrics = readMetrics(results)
        const measurement = createMeasurementResult(finalMetrics, new Date(), {
          conditionLabel: runConditionLabelRef.current,
        })
        setMetrics(finalMetrics)
        setCompletedResult(measurement)
        if (measurement && confirmedDownloadRef.current === null) {
          confirmedDownloadRef.current = measurement.downloadMbps
          setConfirmedDownloadMbps(measurement.downloadMbps)
        }
        setPhase(measurement ? 'complete' : 'error')
        setError(measurement ? null : '速度の測定値を取得できませんでした。もう一度お試しください。')
        setIsRunning(false)
        engineRef.current = null
      }

      engine.onError = (message) => {
        if (!isCurrentRun()) return
        engine.pause()
        setError(toErrorMessage(message))
        setPhase('error')
        setIsRunning(false)
        engineRef.current = null
      }

      engine.play()
    } catch (caughtError: unknown) {
      if (!isCurrentRun()) return
      engineRef.current?.pause()
      engineRef.current = null
      setError(toErrorMessage(caughtError))
      setPhase('error')
      setIsRunning(false)
    }
  }, [stopCurrentTest])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopCurrentTest()
    }
  }, [stopCurrentTest])

  return {
    metrics,
    phase,
    isRunning,
    error,
    completedResult,
    confirmedDownloadMbps,
    start,
  }
}
