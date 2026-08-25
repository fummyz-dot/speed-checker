import { normalizeSpeedValue } from './speedValue'
import type { HorseId } from './horseRaceLanes'

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

export interface ReferenceHorseDurations {
  standard: number
  fast: number
}

export const getReferenceHorseDurations = (): ReferenceHorseDurations => ({
  standard: 13.5,
  fast: 11.5,
})

export const getUserHorseRunDuration = (downloadMbps: number): number => {
  const speed = normalizeSpeedValue(downloadMbps) ?? 0
  return clamp(18 - 2.8 * Math.log10(Math.max(speed, 1)), 9.5, 18)
}

export const getUserHorseJumpHeight = (uploadMbps: number): number => {
  const speed = normalizeSpeedValue(uploadMbps) ?? 0
  return clamp(22 + Math.log10(1 + speed) * 32, 22, 100)
}

export type FrontViewJockeyExpression = 'winner' | 'satisfied' | 'disappointed'

export interface FrontViewUploadRank {
  rank: 1 | 2 | 3
  expression: FrontViewJockeyExpression
}

// These reference values align with the existing fixed front-view jump heights:
// 6 Mbps maps close to the standard jockey's 48px jump and 50 Mbps to the fast
// jockey's 76px jump. They are used only for the facial-expression comparison.
const FRONT_VIEW_REFERENCE_UPLOAD_MBPS: Record<Exclude<HorseId, 'user'>, number> = {
  standard: 6,
  fast: 50,
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
