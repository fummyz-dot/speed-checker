import type { SpeedMeasurementResult } from '../types/measurement'
import { formatMilliseconds } from '../utils/formatMetric'
import { PUBLIC_SITE_URL } from './publicSite'
import { formatFinalSpeedDisplay } from './speedValue'

export const getSharePageUrl = (currentUrl: string): string => {
  void currentUrl
  return PUBLIC_SITE_URL
}

export const createSharePostText = (
  result: SpeedMeasurementResult,
  currentUrl: string,
): string => {
  const lines = [
    'Net Speed Raceで回線を測定しました',
    '',
    `↓ ${formatFinalSpeedDisplay(result.downloadMbps)} Mbps`,
    `↑ ${formatFinalSpeedDisplay(result.uploadMbps)} Mbps`,
  ]

  if (result.pingMs !== null) lines.push(`Ping ${formatMilliseconds(result.pingMs)} ms`)

  lines.push('', '#NetSpeedRace', getSharePageUrl(currentUrl))
  return lines.join('\n')
}

export const createXIntentUrl = (postText: string): string =>
  `https://x.com/intent/post?text=${encodeURIComponent(postText)}`
