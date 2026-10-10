import type { SpeedMeasurementResult, UseCaseEvaluationResult } from '../types/measurement'
import {
  evaluateLoadedLatencyResponsiveness,
  type LoadedLatencyLevel,
} from './loadedLatencyEvaluation'
import { EVALUATION_LABELS } from './measurementEvaluation'
import { PUBLIC_SITE_URL } from './publicSite'
import {
  formatShareRankLabel,
  formatShareRunCount,
  formatShareScore,
  getShareRankingFor,
  type ShareRankingSummary,
} from './sharePost'
import { formatFinalSpeedDisplay } from './speedValue'

export const SHARE_IMAGE_WIDTH = 1200
export const SHARE_IMAGE_HEIGHT = 630

// styles.css の raceboard トークンに合わせた配色。
const COLORS = {
  background: '#151c17',
  raceSurface: '#24372b',
  line: 'rgba(127, 143, 123, 0.38)',
  rule: '#7f8f7b',
  text: '#f2f0e8',
  muted: '#b8b9ad',
  accent: '#f2a077',
} as const

const FONT_SANS = "system-ui, -apple-system, 'Segoe UI', 'Hiragino Sans', 'Yu Gothic UI', Meiryo, sans-serif"
const FONT_EDITORIAL = "Georgia, 'Times New Roman', 'Yu Mincho', 'Hiragino Mincho ProN', serif"
const FONT_RECORD = 'ui-monospace, SFMono-Regular, Consolas, monospace'

const RACE_PANEL = { x: 700, y: 62, width: 424, height: 140 } as const

// レース画面（HorseSprite）と同じ見た目になるよう、レーンごとのidleアセットを対応させる。
const SHARE_HORSE_IDLE_ASSETS = [
  { id: 'standard', src: '/assets/horse/horse-standard-idle.webp', x: 724, y: 98, width: 107, height: 90 },
  { id: 'fast', src: '/assets/horse/horse-user-idle.webp', x: 830, y: 98, width: 107, height: 90 },
  { id: 'user', src: '/assets/horse/horse-fast-idle.webp', x: 930, y: 64, width: 160, height: 135 },
] as const

const RESPONSIVENESS_LABELS: Record<LoadedLatencyLevel, string> = {
  good: '良好',
  notice: '注意',
  poor: '要注意',
  unknown: '判定不可',
}

const formatDate = (value: string): string => new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value))

const loadImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error(`画像を読み込めませんでした: ${src}`))
  image.src = src
})

const drawShareHorses = async (context: CanvasRenderingContext2D): Promise<void> => {
  const { x, y, width, height } = RACE_PANEL
  context.fillStyle = COLORS.raceSurface
  context.fillRect(x, y, width, height)
  context.fillStyle = COLORS.rule
  context.fillRect(x, y + height - 2, width, 2)

  const assets = await Promise.all(SHARE_HORSE_IDLE_ASSETS.map(async (asset) => ({
    ...asset,
    image: await loadImage(asset.src).catch(() => null),
  })))

  assets.forEach(({ image, x: imageX, y: imageY, width: imageWidth, height: imageHeight }) => {
    if (!image) return
    context.drawImage(image, imageX, imageY, imageWidth, imageHeight)
  })
}

const drawRanking = (context: CanvasRenderingContext2D, ranking: ShareRankingSummary): void => {
  const top = 456
  context.fillStyle = COLORS.line
  context.fillRect(76, top, 1048, 1)

  context.textAlign = 'left'
  context.fillStyle = COLORS.muted
  context.font = `700 20px ${FONT_SANS}`
  context.fillText('本日の全国ランキング', 76, top + 46)
  const labelWidth = context.measureText('本日の全国ランキング').width

  const rankLabel = formatShareRankLabel(ranking)
  context.fillStyle = COLORS.accent
  context.font = `700 44px ${FONT_SANS}`
  context.fillText(rankLabel, 76 + labelWidth + 22, top + 50)
  const rankWidth = context.measureText(rankLabel).width

  const runCount = formatShareRunCount(ranking)
  if (runCount) {
    context.fillStyle = COLORS.muted
    context.font = `600 22px ${FONT_SANS}`
    context.fillText(`/ ${runCount}`, 76 + labelWidth + 22 + rankWidth + 12, top + 48)
  }

  context.textAlign = 'right'
  context.fillStyle = COLORS.text
  context.font = `600 44px ${FONT_RECORD}`
  const score = formatShareScore(ranking)
  context.fillText(score, 1124, top + 50)
  const scoreWidth = context.measureText(score).width
  context.fillStyle = COLORS.muted
  context.font = `700 18px ${FONT_SANS}`
  context.fillText('NET SPEED SCORE', 1124 - scoreWidth - 18, top + 46)
  context.textAlign = 'left'
}

export const createShareImageBlob = async (
  result: SpeedMeasurementResult,
  evaluations: UseCaseEvaluationResult[],
  ranking: ShareRankingSummary | null = null,
): Promise<Blob> => {
  const canvas = document.createElement('canvas')
  canvas.width = SHARE_IMAGE_WIDTH
  canvas.height = SHARE_IMAGE_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('画像を生成できませんでした')

  const validRanking = getShareRankingFor(result, ranking)

  context.fillStyle = COLORS.background
  context.fillRect(0, 0, SHARE_IMAGE_WIDTH, SHARE_IMAGE_HEIGHT)
  context.strokeStyle = COLORS.line
  context.lineWidth = 2
  context.strokeRect(38, 38, 1124, 554)

  context.fillStyle = COLORS.accent
  context.font = `700 20px ${FONT_SANS}`
  context.fillText('NET SPEED RACE', 76, 94)
  context.fillStyle = COLORS.text
  context.font = `400 46px ${FONT_EDITORIAL}`
  context.fillText('今回のインターネット速度', 76, 152)
  context.fillStyle = COLORS.muted
  context.font = `22px ${FONT_SANS}`
  context.fillText(formatDate(result.measuredAt), 78, 192)
  await drawShareHorses(context)

  const metrics = [
    { label: 'DOWNLOAD', value: result.downloadMbps, unit: 'Mbps', x: 76 },
    { label: 'UPLOAD', value: result.uploadMbps, unit: 'Mbps', x: 430 },
    { label: 'PING', value: result.pingMs, unit: 'ms', x: 784 },
  ]
  context.fillStyle = COLORS.line
  context.fillRect(76, 232, 1048, 1)
  metrics.forEach((metric) => {
    context.fillStyle = COLORS.muted
    context.font = `700 18px ${FONT_SANS}`
    context.fillText(metric.label, metric.x, 272)
    context.fillStyle = COLORS.text
    context.font = `600 66px ${FONT_RECORD}`
    const value = metric.label === 'PING'
      ? metric.value === null ? '—' : Math.round(metric.value).toLocaleString('ja-JP')
      : formatFinalSpeedDisplay(metric.value)
    context.fillText(value, metric.x, 344)
    const valueWidth = context.measureText(value).width
    context.fillStyle = COLORS.accent
    context.font = `700 20px ${FONT_SANS}`
    context.fillText(metric.unit, metric.x + valueWidth + 14, 341)
  })

  context.fillStyle = COLORS.line
  context.fillRect(76, 366, 1048, 1)
  context.fillStyle = COLORS.text
  context.font = `600 21px ${FONT_SANS}`
  const summary = evaluations.slice(0, 3).map((item) =>
    `${item.label}: ${EVALUATION_LABELS[item.level]}`,
  ).join('　｜　')
  context.fillText(summary, 76, 402)
  const responsiveness = evaluateLoadedLatencyResponsiveness({
    idleLatencyMs: result.pingMs,
    downloadLoadedLatencyMs: result.downloadLoadedLatencyMs,
    uploadLoadedLatencyMs: result.uploadLoadedLatencyMs,
  })
  context.fillStyle = COLORS.muted
  context.font = `600 19px ${FONT_SANS}`
  context.fillText(`負荷による遅延増加 ${RESPONSIVENESS_LABELS[responsiveness.overall]}`, 76, 432)

  if (validRanking) drawRanking(context, validRanking)

  context.fillStyle = COLORS.muted
  context.font = `19px ${FONT_SANS}`
  context.fillText('今回の測定結果・参考値', 76, 562)
  context.textAlign = 'right'
  context.fillText(PUBLIC_SITE_URL, 1124, 562)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('画像を生成できませんでした'))
    }, 'image/png')
  })
}

export const createShareFilename = (measuredAt: string): string => {
  const date = new Date(measuredAt)
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    '-',
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
  ]
  return `net-speed-race-${parts.join('')}.png`
}

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
