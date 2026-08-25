export interface SpeedMeasurementResult {
  id: string
  measuredAt: string
  downloadMbps: number
  uploadMbps: number
  pingMs: number | null
  conditionLabel?: string | null
}

export type EvaluationLevel = 'comfortable' | 'available' | 'difficult' | 'unknown'

export interface UseCaseEvaluationResult {
  id: 'browsing' | 'video' | 'meeting' | 'gaming' | 'file-upload'
  label: string
  level: EvaluationLevel
  detail: string
}
