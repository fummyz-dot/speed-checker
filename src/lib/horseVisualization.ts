import { normalizeSpeedValue } from './speedValue'
import type { HorseId } from './horseRaceLanes'

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

export interface ReferenceHorseDurations {
  standard: number
  fast: number
}

export const OGURI_REFERENCE_DOWNLOAD_MBPS = 700
export const OGURI_REFERENCE_UPLOAD_MBPS = 250

export const getUserHorseRunDuration = (downloadMbps: number): number => {
  const speed = normalizeSpeedValue(downloadMbps) ?? 0
  return clamp(18 - 2.8 * Math.log10(Math.max(speed, 1)), 9.5, 18)
}

export const getReferenceHorseDurations = (): ReferenceHorseDurations => ({
  standard: 13.5,
  fast: getUserHorseRunDuration(OGURI_REFERENCE_DOWNLOAD_MBPS),
})

export const getUserHorseJumpHeight = (uploadMbps: number): number => {
  const speed = normalizeSpeedValue(uploadMbps) ?? 0
  return clamp(22 + Math.log10(1 + speed) * 32, 22, 100)
}

export type FrontViewJockeyExpression = 'winner' | 'satisfied' | 'disappointed'

export interface FrontViewUploadRank {
  rank: 1 | 2 | 3
  expression: FrontViewJockeyExpression
}

// These reference values determine front-view facial-expression comparison.
// The standard jockey keeps its existing 6 Mbps reference, while the fast jockey
// shares the 250 Mbps Oguri benchmark used for its jump height.
const FRONT_VIEW_REFERENCE_UPLOAD_MBPS: Record<Exclude<HorseId, 'user'>, number> = {
  standard: 6,
  fast: OGURI_REFERENCE_UPLOAD_MBPS,
}

const expressionForRank = (rank: FrontViewUploadRank['rank']): FrontViewJockeyExpression => {
  if (rank === 1) return 'winner'
  if (rank === 2) return 'satisfied'
  return 'disappointed'
}

export const getFrontViewUploadRanks = (
  userUploadMbps: number | null | undefined,
): Record<HorseId, FrontViewUploadRank> => {
  const uploadValues: Array<{ id: HorseId; value: number }> = [
    { id: 'standard', value: FRONT_VIEW_REFERENCE_UPLOAD_MBPS.standard },
    { id: 'user', value: normalizeSpeedValue(userUploadMbps) ?? 0 },
    { id: 'fast', value: FRONT_VIEW_REFERENCE_UPLOAD_MBPS.fast },
  ]

  uploadValues.sort((left, right) => right.value - left.value || left.id.localeCompare(right.id))

  return uploadValues.reduce((ranks, { id }, index) => {
    const rank = (index + 1) as FrontViewUploadRank['rank']
    ranks[id] = { rank, expression: expressionForRank(rank) }
    return ranks
  }, {} as Record<HorseId, FrontViewUploadRank>)
}
