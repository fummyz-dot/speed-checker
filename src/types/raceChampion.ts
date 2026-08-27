export type RaceChampionSource = 'previous_day_winner' | 'fallback'

export interface RaceChampionReference {
  downloadMbps: number
  uploadMbps: number
  source: RaceChampionSource
  sourceDay: string | null
  scoreTenths: number | null
  qualifyingRuns: number
}

export const DEFAULT_RACE_CHAMPION_REFERENCE: RaceChampionReference = {
  downloadMbps: 700,
  uploadMbps: 250,
  source: 'fallback',
  sourceDay: null,
  scoreTenths: null,
  qualifyingRuns: 0,
}
