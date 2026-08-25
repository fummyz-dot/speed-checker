import type { SpeedMeasurementResult } from '../types/measurement'
import { formatMilliseconds } from '../utils/formatMetric'
import { formatFinalSpeedDisplay } from './speedValue'

export const getSharePageUrl = (currentUrl: string): string => {
  try {
    const url = new URL(currentUrl)
    return `${url.origin}${url.pathname}`
  } catch {
    return currentUrl
  }
}

export const createSharePostText = (
  result: SpeedMeasurementResult,
  currentUrl: string,
): string => {
  const lines = [
    'Speed Checkerで回線を測定しました',
    '',
    `↓ ${formatFinalSpeedDisplay(result.downloadMbps)} Mbps`,
    `↑ ${formatFinalSpeedDisplay(result.uploadMbps)} Mbps`,
  ]

  if (result.pingMs !== null) lines.push(`Ping ${formatMilliseconds(result.pingMs)} ms`)

  lines.push('', '#SpeedChecker', getSharePageUrl(currentUrl))
  return lines.join('\n')
}

export const createXIntentUrl = (postText: string): string =>
  `https://x.com/intent/post?text=${encodeURIComponent(postText)}`
