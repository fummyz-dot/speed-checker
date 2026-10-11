import type { DownloadDistribution } from '../features/ranking/types'

export interface DownloadPosition {
  /** "上位" when the measurement is at or above the median cut, otherwise "下位". */
  side: '上位' | '下位'
  /** Upper bound of the band in percent: 10, 20, ..., 50. */
  withinPercent: number
  totalRuns: number
  windowDays: number
}

/**
 * Places a download measurement within published decile cut points, entirely in the browser.
 * The measurement itself is never sent anywhere for this comparison.
 */
export const getDownloadPosition = (
  downloadMbps: number | null | undefined,
  distribution: DownloadDistribution | null | undefined,
): DownloadPosition | null => {
  if (!distribution || downloadMbps == null || !Number.isFinite(downloadMbps) || downloadMbps < 0) return null
  if (distribution.decilesTenths.length !== 9) return null

  const downloadTenths = Math.round((downloadMbps + Number.EPSILON) * 10)
  const cutsAtOrBelow = distribution.decilesTenths.filter((cut) => downloadTenths >= cut).length
  const base = { totalRuns: distribution.totalRuns, windowDays: distribution.windowDays }

  return cutsAtOrBelow >= 5
    ? { ...base, side: '上位', withinPercent: (10 - cutsAtOrBelow) * 10 }
    : { ...base, side: '下位', withinPercent: (cutsAtOrBelow + 1) * 10 }
}

export const formatDownloadPositionParts = (position: DownloadPosition): [string, string] => [
  `直近${position.windowDays}日の出走${position.totalRuns.toLocaleString('ja-JP')}件のうち、`,
  `下り速度は${position.side}${position.withinPercent}%以内`,
]

export const formatDownloadPosition = (position: DownloadPosition): string =>
  formatDownloadPositionParts(position).join('')
