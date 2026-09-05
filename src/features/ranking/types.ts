import type { SpeedMeasurementResult } from '../../types/measurement'
import type { RaceChampionReference } from '../../types/raceChampion'

export type RankingChampionSummary = RaceChampionReference

export interface RankingContext {
  ok: true
  rankingAvailable: boolean
  rankingDay: string
  ticket: string | null
  ticketExpiresAtMs: number | null
  unavailableReason?: 'country_not_eligible'
  champion: RankingChampionSummary
}

export interface RankingTopEntry {
  rank: number
  scoreTenths: number
}

export interface RankingOverviewPreview {
  ok: true
  rankingDay: string
  totalRuns: number
  top3: RankingTopEntry[]
}

export interface RankingSubmissionResult {
  ok: true
  entry: {
    scoreTenths: number
    rank: number
    tieCount: number
    totalRuns: number
    topPercentTenths: number | null
  }
  top3: RankingTopEntry[]
  champion: RankingChampionSummary
}

export type RankingErrorCode =
  | 'INVALID_REQUEST'
  | 'COUNTRY_NOT_ELIGIBLE'
  | 'INVALID_TICKET'
  | 'TICKET_EXPIRED'
  | 'SCORE_VERSION_MISMATCH'
  | 'MEASUREMENT_NOT_ELIGIBLE'
  | 'TURNSTILE_FAILED'
  | 'SERVICE_UNAVAILABLE'

export interface RankingService {
  getContext(): Promise<RankingContext>
  getOverview(): Promise<RankingOverviewPreview>
  submitMeasurement(
    measurement: SpeedMeasurementResult,
    turnstileToken: string,
  ): Promise<RankingSubmissionResult>
}
