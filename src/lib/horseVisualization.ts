import { normalizeSpeedValue } from './speedValue'

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
  return clamp(10 + Math.log10(1 + speed) * 14, 10, 52)
}
