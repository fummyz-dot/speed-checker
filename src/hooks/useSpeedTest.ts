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

const valueOrNull = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const readMetrics = (results: Results): SpeedTestMetrics => ({
  download: valueOrNull(results.getDownloadBandwidth()),
  upload: valueOrNull(results.getUploadBandwidth()),
  latency: valueOrNull(results.getUnloadedLatency()),
  jitter: valueOrNull(results.getUnloadedJitter()),
  downloadLoadedLatency: valueOrNull(results.getDownLoadedLatency()),
  uploadLoadedLatency: valueOrNull(results.getUpLoadedLatency()),
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
  start: () => void
}

export const useSpeedTest = (): UseSpeedTestResult => {
  const engineRef = useRef<SpeedTest | null>(null)
  const runIdRef = useRef(0)
  const mountedRef = useRef(true)
  const [metrics, setMetrics] = useState<SpeedTestMetrics>(EMPTY_METRICS)
  const [phase, setPhase] = useState<TestPhase>('idle')
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stopCurrentTest = useCallback(() => {
    runIdRef.current += 1
    engineRef.current?.pause()
    engineRef.current = null
  }, [])

  const start = useCallback(() => {
    stopCurrentTest()

    const runId = runIdRef.current
    setMetrics(EMPTY_METRICS)
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
          setPhase(measurement.type)
        }
      }

      engine.onResultsChange = () => {
        if (!isCurrentRun()) return
        setMetrics(readMetrics(engine.results))
      }

      engine.onFinish = (results) => {
        if (!isCurrentRun()) return
        setMetrics(readMetrics(results))
        setPhase('complete')
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

  return { metrics, phase, isRunning, error, start }
}
