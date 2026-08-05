import type { SpeedMeasurementResult, UseCaseEvaluationResult } from '../types/measurement'
import { EVALUATION_LABELS } from './measurementEvaluation'
import { formatFinalSpeedDisplay } from './speedValue'

export const SHARE_IMAGE_WIDTH = 1200
export const SHARE_IMAGE_HEIGHT = 630

const formatDate = (value: string): string => new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value))

const drawHorse = (context: CanvasRenderingContext2D, x: number, y: number): void => {
  context.save()
  context.translate(x, y)
  context.fillStyle = '#75e5c2'
  context.beginPath()
  context.ellipse(40, 34, 37, 22, -0.12, 0, Math.PI * 2)
  context.ellipse(77, 18, 18, 13, 0.15, 0, Math.PI * 2)
  context.moveTo(87, 11)
  context.lineTo(91, -2)
  context.lineTo(80, 9)
  context.moveTo(8, 29)
  context.lineTo(-12, 14)
  context.lineTo(12, 39)
  context.fill()
  context.strokeStyle = '#75e5c2'
  context.lineWidth = 8
  context.lineCap = 'round'
  context.beginPath()
  context.moveTo(22, 48)
  context.lineTo(11, 76)
  context.moveTo(48, 51)
  context.lineTo(61, 76)
  context.moveTo(58, 46)
  context.lineTo(76, 66)
  context.stroke()
  context.restore()
}

export const createShareImageBlob = (
  result: SpeedMeasurementResult,
  evaluations: UseCaseEvaluationResult[],
): Promise<Blob> => {
  const canvas = document.createElement('canvas')
  canvas.width = SHARE_IMAGE_WIDTH
  canvas.height = SHARE_IMAGE_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('画像を生成できませんでした'))

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
  context.fillText('SPEED CHECKER', 76, 94)
  context.fillStyle = '#f5f7fb'
  context.font = '700 48px system-ui, sans-serif'
  context.fillText('今回のインターネット速度', 76, 162)
  context.fillStyle = '#929bab'
  context.font = '24px system-ui, sans-serif'
  context.fillText(formatDate(result.measuredAt), 78, 205)
  drawHorse(context, 970, 90)

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
  context.fillRect(76, 410, 1048, 82)
  context.fillStyle = '#dce3eb'
  context.font = '600 21px system-ui, sans-serif'
  const summary = evaluations.slice(0, 3).map((item) =>
    `${item.label}: ${EVALUATION_LABELS[item.level]}`,
  ).join('　｜　')
  context.fillText(summary, 102, 460)

  context.fillStyle = '#929bab'
  context.font = '19px system-ui, sans-serif'
  context.fillText('今回の測定結果・参考値', 76, 548)
  context.textAlign = 'right'
  context.fillText('speed-checker.web-tools-jp.workers.dev', 1124, 548)

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
  return `speed-checker-${parts.join('')}.png`
}

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
