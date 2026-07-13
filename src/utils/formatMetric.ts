const isUsableNumber = (value: number | null): value is number =>
  value !== null && Number.isFinite(value)

export const formatSpeed = (bitsPerSecond: number | null): string => {
  if (!isUsableNumber(bitsPerSecond)) return '—'

  const megabitsPerSecond = bitsPerSecond / 1_000_000
  return megabitsPerSecond < 100
    ? megabitsPerSecond.toFixed(1)
    : Math.round(megabitsPerSecond).toLocaleString('ja-JP')
}

export const formatMilliseconds = (milliseconds: number | null): string => {
  if (!isUsableNumber(milliseconds)) return '—'

  return milliseconds < 10
    ? milliseconds.toFixed(1)
    : Math.round(milliseconds).toLocaleString('ja-JP')
}

