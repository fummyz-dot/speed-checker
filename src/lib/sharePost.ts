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

/** Xのカードキャッシュを避けるため、canonicalとは別にシェア元パラメータを付ける。 */
export const SHARE_PAGE_URL = `${PUBLIC_SITE_URL}?s=x`

/** ランキング画面で上位%を出す最小出走数。これ未満では投稿文にも出走数を出さない。 */
export const MIN_RUNS_FOR_RUN_COUNT = 10

export const getSharePageUrl = (currentUrl: string): string => {
  void currentUrl
  return SHARE_PAGE_URL
}

const isValidRanking = (ranking: ShareRankingSummary): boolean =>
  Number.isInteger(ranking.rank)
  && ranking.rank >= 1
  && Number.isInteger(ranking.totalRuns)
  && ranking.totalRuns >= ranking.rank
  && Number.isFinite(ranking.scoreTenths)

export const formatShareRankingLine = (ranking: ShareRankingSummary): string => {
  const runCount = formatShareRunCount(ranking)
  return `本日の全国ランキング ${formatShareRankLabel(ranking)}${runCount ? ` / ${runCount}` : ''}（スコア ${formatShareScore(ranking)}）`
}

/** 同じ測定の妥当な順位だけを返す。投稿文と共有PNGで同じ判定を使う。 */
export const getShareRankingFor = (
  result: SpeedMeasurementResult,
  ranking: ShareRankingSummary | null,
): ShareRankingSummary | null =>
  ranking && ranking.measurementId === result.id && isValidRanking(ranking) ? ranking : null

export const formatShareRankLabel = (ranking: ShareRankingSummary): string =>
  ranking.tieCount > 1 ? `同率${ranking.rank}位` : `${ranking.rank}位`

export const formatShareRunCount = (ranking: ShareRankingSummary): string | null =>
  ranking.totalRuns >= MIN_RUNS_FOR_RUN_COUNT ? `${ranking.totalRuns}頭` : null

export const formatShareScore = (ranking: ShareRankingSummary): string =>
  (ranking.scoreTenths / 10).toFixed(1)

export const createSharePostText = (
  result: SpeedMeasurementResult,
  currentUrl: string,
  ranking: ShareRankingSummary | null = null,
): string => {
  const lines = ['Net Speed Raceで回線を測定しました']

  const validRanking = getShareRankingFor(result, ranking)
  if (validRanking) lines.push(formatShareRankingLine(validRanking))

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
