import type { SpeedMeasurementResult } from '../types/measurement'
import { formatMilliseconds } from '../utils/formatMetric'
import { PUBLIC_SITE_URL } from './publicSite'
import { formatFinalSpeedDisplay } from './speedValue'

/** 匿名ランキングへ参加した場合だけ投稿文へ含める、本日の順位とスコア。 */
export interface ShareRankingSummary {
  measurementId: string
  rank: number
  tieCount: number
  totalRuns: number
  scoreTenths: number
}

export const getSharePageUrl = (currentUrl: string): string => {
  void currentUrl
  return PUBLIC_SITE_URL
}

const isValidRanking = (ranking: ShareRankingSummary): boolean =>
  Number.isInteger(ranking.rank)
  && ranking.rank >= 1
  && Number.isInteger(ranking.totalRuns)
  && ranking.totalRuns >= ranking.rank
  && Number.isFinite(ranking.scoreTenths)

export const formatShareRankingLine = (ranking: ShareRankingSummary): string => {
  const rankLabel = ranking.tieCount > 1 ? `同率${ranking.rank}位` : `${ranking.rank}位`
  const score = (ranking.scoreTenths / 10).toFixed(1)
  return `本日の全国ランキング ${rankLabel} / ${ranking.totalRuns}頭（Net Speed Score ${score}）`
}

export const createSharePostText = (
  result: SpeedMeasurementResult,
  currentUrl: string,
  ranking: ShareRankingSummary | null = null,
): string => {
  const lines = ['Net Speed Raceで回線を測定しました']

  if (ranking && ranking.measurementId === result.id && isValidRanking(ranking)) {
    lines.push(formatShareRankingLine(ranking))
  }

  lines.push(
    '',
    `↓ ${formatFinalSpeedDisplay(result.downloadMbps)} Mbps`,
    `↑ ${formatFinalSpeedDisplay(result.uploadMbps)} Mbps`,
  )

  if (result.pingMs !== null) lines.push(`Ping ${formatMilliseconds(result.pingMs)} ms`)

  lines.push('', 'あなたの回線は何着？', '#NetSpeedRace', getSharePageUrl(currentUrl))
  return lines.join('\n')
}

export const createXIntentUrl = (postText: string): string =>
  `https://x.com/intent/post?text=${encodeURIComponent(postText)}`
