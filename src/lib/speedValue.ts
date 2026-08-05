export const MAX_DISPLAY_SPEED_MBPS = 10_000

const isFiniteNonNegativeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

export const normalizeSpeedValue = (value: unknown): number | null => {
  if (!isFiniteNonNegativeNumber(value)) return null
  return Math.min(value, MAX_DISPLAY_SPEED_MBPS)
}

export const bandwidthBitsToMbps = (bitsPerSecond: unknown): number | null => {
  if (!isFiniteNonNegativeNumber(bitsPerSecond)) return null
  return normalizeSpeedValue(bitsPerSecond / 1_000_000)
}

export const isSpeedValueInDisplayRange = (value: unknown): value is number =>
  isFiniteNonNegativeNumber(value) && value <= MAX_DISPLAY_SPEED_MBPS

export const formatLiveSpeedDisplay = (value: unknown): string => {
  const normalized = normalizeSpeedValue(value)
  return normalized === null ? '—' : normalized.toFixed(6)
}

export const formatFinalSpeedDisplay = (value: unknown): string => {
  const normalized = normalizeSpeedValue(value)
  if (normalized === null) return '—'

  return normalized < 100
    ? normalized.toFixed(1)
    : Math.round(normalized).toLocaleString('ja-JP')
}
