export const RUN_TIME_MAPPING_VERSION = 1
export const RUN_SCORE_MAX_TENTHS = 20_608
export const RUN_SCORE_MAX_EFFECTIVE_TENTHS = 8_500
export const RUN_TIME_MIN_TENTHS = 250
export const RUN_TIME_MAX_TENTHS = 500

export const mapScoreTenthsToRunTimeTenths = (scoreTenths: number): number => {
  if (!Number.isSafeInteger(scoreTenths) || scoreTenths < 0) {
    throw new RangeError('scoreTenths must be a non-negative safe integer')
  }

  const clampedScore = Math.min(RUN_SCORE_MAX_EFFECTIVE_TENTHS, scoreTenths)
  return RUN_TIME_MIN_TENTHS + Math.floor(
    (clampedScore * (RUN_TIME_MAX_TENTHS - RUN_TIME_MIN_TENTHS))
      / RUN_SCORE_MAX_EFFECTIVE_TENTHS,
  )
}
