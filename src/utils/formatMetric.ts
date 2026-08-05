import {
  bandwidthBitsToMbps,
  formatFinalSpeedDisplay,
} from '../lib/speedValue'

const isUsableNumber = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value >= 0

export const formatSpeed = (bitsPerSecond: number | null): string => {
  return formatFinalSpeedDisplay(bandwidthBitsToMbps(bitsPerSecond))
}

export const formatMilliseconds = (milliseconds: number | null): string => {
  if (!isUsableNumber(milliseconds)) return '—'

  return milliseconds < 10
    ? milliseconds.toFixed(1)
    : Math.round(milliseconds).toLocaleString('ja-JP')
}
