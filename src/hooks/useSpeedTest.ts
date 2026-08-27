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

const speedTestConfig = {
  autoStart: false,
  measurements,
  measureDownloadLoadedLatency: true,
  measureUploadLoadedLatency: true,
  logAimApiUrl: null,
}

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

const VISIBILITY_INTERRUPTION_ERROR = '測定中に画面を離れたため、今回の測定を中断しました。正確に比較するため、画面を開いたままもう一度測定してください。'

interface WakeLockSentinelLike {
  release: () => Promise<void>
}

interface WakeLockNavigator {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>
  }
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
  const activeRunIdRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null)
  const confirmedDownloadRef = useRef<number | null>(null)
  const runConditionLabelRef = useRef<string | null>(null)
  const [metrics, setMetrics] = useState<SpeedTestMetrics>(EMPTY_METRICS)
  const [phase, setPhase] = useState<TestPhase>('idle')
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completedResult, setCompletedResult] = useState<SpeedMeasurementResult | null>(null)
  const [confirmedDownloadMbps, setConfirmedDownloadMbps] = useState<number | null>(null)

  const releaseWakeLock = useCallback(() => {
    const wakeLock = wakeLockRef.current
    wakeLockRef.current = null
    if (!wakeLock) return
    void wakeLock.release().catch(() => undefined)
  }, [])

  const requestWakeLock = useCallback((runId: number) => {
    if (typeof navigator === 'undefined') return
    const wakeLock = (navigator as Navigator & WakeLockNavigator).wakeLock
    if (!wakeLock) return

    try {
      void wakeLock.request('screen')
        .then((sentinel) => {
          if (mountedRef.current && activeRunIdRef.current === runId) {
            wakeLockRef.current = sentinel
            return
          }
          void sentinel.release().catch(() => undefined)
        })
        .catch(() => undefined)
    } catch {
      // Wake Lock is optional. Its failure must not affect measurement.
    }
  }, [])

  const stopCurrentTest = useCallback(() => {
    runIdRef.current += 1
    activeRunIdRef.current = null
    engineRef.current?.pause()
    engineRef.current = null
    releaseWakeLock()
  }, [releaseWakeLock])

  const interruptForVisibility = useCallback(() => {
    if (!mountedRef.current || activeRunIdRef.current === null) return

    runIdRef.current += 1
    activeRunIdRef.current = null
    engineRef.current?.pause()
    engineRef.current = null
    releaseWakeLock()
    confirmedDownloadRef.current = null
    runConditionLabelRef.current = null
    setMetrics(EMPTY_METRICS)
    setCompletedResult(null)
    setConfirmedDownloadMbps(null)
    setError(VISIBILITY_INTERRUPTION_ERROR)
    setPhase('error')
    setIsRunning(false)
  }, [releaseWakeLock])

  const start = useCallback((options?: StartSpeedTestOptions) => {
    stopCurrentTest()

    const runId = runIdRef.current
    activeRunIdRef.current = runId
    runConditionLabelRef.current = normalizeConditionLabel(options?.conditionLabel)
    setMetrics(EMPTY_METRICS)
    setCompletedResult(null)
    confirmedDownloadRef.current = null
    setConfirmedDownloadMbps(null)
    setError(null)
    setPhase('latency')
    setIsRunning(true)
    requestWakeLock(runId)

    const isCurrentRun = () => mountedRef.current && runIdRef.current === runId

    try {
      const engine = new SpeedTest(speedTestConfig)
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
        activeRunIdRef.current = null
        engineRef.current = null
        releaseWakeLock()
      }

      engine.onError = (message) => {
        if (!isCurrentRun()) return
        engine.pause()
        setError(toErrorMessage(message))
        setPhase('error')
        setIsRunning(false)
        activeRunIdRef.current = null
        engineRef.current = null
        releaseWakeLock()
      }

      engine.play()
    } catch (caughtError: unknown) {
      if (!isCurrentRun()) return
      engineRef.current?.pause()
      engineRef.current = null
      setError(toErrorMessage(caughtError))
      setPhase('error')
      setIsRunning(false)
      activeRunIdRef.current = null
      releaseWakeLock()
    }
  }, [releaseWakeLock, requestWakeLock, stopCurrentTest])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') interruptForVisibility()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', interruptForVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', interruptForVisibility)
    }
  }, [interruptForVisibility])

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
