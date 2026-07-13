export type TestPhase =
  | 'idle'
  | 'latency'
  | 'download'
  | 'upload'
  | 'complete'
  | 'error'

export interface SpeedTestMetrics {
  download: number | null
  upload: number | null
  latency: number | null
  jitter: number | null
  downloadLoadedLatency: number | null
  uploadLoadedLatency: number | null
}

export const EMPTY_METRICS: SpeedTestMetrics = {
  download: null,
  upload: null,
  latency: null,
  jitter: null,
  downloadLoadedLatency: null,
  uploadLoadedLatency: null,
}

