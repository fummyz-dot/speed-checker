import type { SpeedMeasurementResult, UseCaseEvaluationResult } from '../types/measurement'
import {
  evaluateLoadedLatencyResponsiveness,
  type LoadedLatencyLevel,
} from './loadedLatencyEvaluation'
import { EVALUATION_LABELS } from './measurementEvaluation'
import { PUBLIC_SITE_URL } from './publicSite'
import { formatFinalSpeedDisplay } from './speedValue'

export const SHARE_IMAGE_WIDTH = 1200
export const SHARE_IMAGE_HEIGHT = 630

const SHARE_HORSE_IDLE_ASSETS = [
  { id: 'standard', src: '/assets/horse/horse-standard-idle.webp', x: 880, y: 66, width: 74, height: 62 },
  { id: 'user', src: '/assets/horse/horse-user-idle.webp', x: 950, y: 48, width: 98, height: 83 },
  { id: 'fast', src: '/assets/horse/horse-fast-idle.webp', x: 1050, y: 66, width: 74, height: 62 },
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
  const assets = await Promise.all(SHARE_HORSE_IDLE_ASSETS.map(async (asset) => ({
    ...asset,
    image: await loadImage(asset.src).catch(() => null),
  })))

  assets.forEach(({ id, image, x, y, width, height }) => {
    if (!image) return
    context.save()
    if (id === 'user') {
      context.shadowColor = 'rgba(117, 229, 194, 0.42)'
      context.shadowBlur = 12
    }
    context.drawImage(image, x, y, width, height)
    context.restore()
  })
}

export const createShareImageBlob = async (
  result: SpeedMeasurementResult,
  evaluations: UseCaseEvaluationResult[],
): Promise<Blob> => {
  const canvas = document.createElement('canvas')
  canvas.width = SHARE_IMAGE_WIDTH
  canvas.height = SHARE_IMAGE_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('画像を生成できませんでした')

  const gradient = context.createLinearGradient(0, 0, SHARE_IMAGE_WIDTH, SHARE_IMAGE_HEIGHT)
  gradient.addColorStop(0, '#080b12')
  gradient.addColorStop(1, '#111d24')
  context.fillStyle = gradient
  context.fillRect(0, 0, SHARE_IMAGE_WIDTH, SHARE_IMAGE_HEIGHT)
  context.strokeStyle = 'rgba(117, 229, 194, 0.24)'
  context.lineWidth = 2
  context.strokeRect(38, 38, 1124, 554)

  context.fillStyle = '#75e5c2'
  context.font = '700 25px system-ui, sans-serif'
  context.fillText('NET SPEED RACE', 76, 94)
  context.fillStyle = '#f5f7fb'
  context.font = '700 48px system-ui, sans-serif'
  context.fillText('今回のインターネット速度', 76, 162)
  context.fillStyle = '#929bab'
  context.font = '24px system-ui, sans-serif'
  context.fillText(formatDate(result.measuredAt), 78, 205)
  await drawShareHorses(context)

  const metrics = [
    { label: 'DOWNLOAD', value: result.downloadMbps, unit: 'Mbps', x: 76 },
    { label: 'UPLOAD', value: result.uploadMbps, unit: 'Mbps', x: 430 },
    { label: 'PING', value: result.pingMs, unit: 'ms', x: 784 },
  ]
  metrics.forEach((metric) => {
    context.fillStyle = '#929bab'
    context.font = '700 18px system-ui, sans-serif'
    context.fillText(metric.label, metric.x, 280)
    context.fillStyle = '#f5f7fb'
    context.font = '600 70px system-ui, sans-serif'
    const value = metric.label === 'PING'
      ? metric.value === null ? '—' : Math.round(metric.value).toLocaleString('ja-JP')
      : formatFinalSpeedDisplay(metric.value)
    context.fillText(value, metric.x, 360)
    const valueWidth = context.measureText(value).width
    context.fillStyle = '#75e5c2'
    context.font = '700 20px system-ui, sans-serif'
    context.fillText(metric.unit, metric.x + valueWidth + 14, 357)
  })

  context.fillStyle = 'rgba(117, 229, 194, 0.08)'
  context.fillRect(76, 410, 1048, 96)
  context.fillStyle = '#dce3eb'
  context.font = '600 21px system-ui, sans-serif'
  const summary = evaluations.slice(0, 3).map((item) =>
    `${item.label}: ${EVALUATION_LABELS[item.level]}`,
  ).join('　｜　')
  context.fillText(summary, 102, 454)
  const responsiveness = evaluateLoadedLatencyResponsiveness({
    idleLatencyMs: result.pingMs,
    downloadLoadedLatencyMs: result.downloadLoadedLatencyMs,
    uploadLoadedLatencyMs: result.uploadLoadedLatencyMs,
  })
  context.fillStyle = '#929bab'
  context.font = '600 19px system-ui, sans-serif'
  context.fillText(`混雑時の応答性 ${RESPONSIVENESS_LABELS[responsiveness.overall]}`, 102, 486)

  context.fillStyle = '#929bab'
  context.font = '19px system-ui, sans-serif'
  context.fillText('今回の測定結果・参考値', 76, 548)
  context.textAlign = 'right'
  context.fillText(PUBLIC_SITE_URL, 1124, 548)

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
