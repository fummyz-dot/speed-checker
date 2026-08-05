import type {
  EvaluationLevel,
  SpeedMeasurementResult,
  UseCaseEvaluationResult,
} from '../types/measurement'
import { toValidMetric } from './measurementValidation'

export const EVALUATION_THRESHOLDS = {
  browsing: { comfortableDownload: 5, availableDownload: 1 },
  video: { comfortableDownload: 25, availableDownload: 5 },
  meeting: {
    comfortableDownload: 10,
    comfortableUpload: 5,
    comfortablePing: 80,
    availableDownload: 3,
    availableUpload: 3,
    availablePing: 150,
  },
  gaming: {
    comfortableDownload: 5,
    comfortableUpload: 1,
    comfortablePing: 50,
    availableDownload: 3,
    availableUpload: 1,
    availablePing: 100,
  },
  fileUpload: { comfortableUpload: 20, availableUpload: 5 },
} as const

export const EVALUATION_LABELS: Record<EvaluationLevel, string> = {
  comfortable: '快適',
  available: '利用可能',
  difficult: '厳しい可能性',
  unknown: '判定不可',
}

type MeasurementInput = Partial<SpeedMeasurementResult>

const basicLevel = (
  value: number,
  comfortable: number,
  available: number,
): EvaluationLevel => {
  if (value >= comfortable) return 'comfortable'
  if (value >= available) return 'available'
  return 'difficult'
}

export const evaluateUseCases = (
  result: MeasurementInput,
): UseCaseEvaluationResult[] => {
  const download = toValidMetric(result.downloadMbps)
  const upload = toValidMetric(result.uploadMbps)
  const ping = result.pingMs === null ? null : toValidMetric(result.pingMs)
  const pingWasProvided = result.pingMs !== null && result.pingMs !== undefined

  const unavailable = (id: UseCaseEvaluationResult['id'], label: string): UseCaseEvaluationResult => ({
    id,
    label,
    level: 'unknown',
    detail: '必要な測定値を取得できませんでした',
  })

  const browsingLevel = download === null
    ? null
    : basicLevel(
      download,
      EVALUATION_THRESHOLDS.browsing.comfortableDownload,
      EVALUATION_THRESHOLDS.browsing.availableDownload,
    )
  const videoLevel = download === null
    ? null
    : basicLevel(
      download,
      EVALUATION_THRESHOLDS.video.comfortableDownload,
      EVALUATION_THRESHOLDS.video.availableDownload,
    )

  let meetingLevel: EvaluationLevel | null = null
  if (download !== null && upload !== null && (!pingWasProvided || ping !== null)) {
    const comfortable = download >= EVALUATION_THRESHOLDS.meeting.comfortableDownload
      && upload >= EVALUATION_THRESHOLDS.meeting.comfortableUpload
      && (ping === null || ping <= EVALUATION_THRESHOLDS.meeting.comfortablePing)
    const available = download >= EVALUATION_THRESHOLDS.meeting.availableDownload
      && upload >= EVALUATION_THRESHOLDS.meeting.availableUpload
      && (ping === null || ping <= EVALUATION_THRESHOLDS.meeting.availablePing)
    meetingLevel = comfortable ? 'comfortable' : available ? 'available' : 'difficult'
  }

  let gamingLevel: EvaluationLevel | null = null
  if (download !== null && upload !== null && (!pingWasProvided || ping !== null)) {
    const comfortable = download >= EVALUATION_THRESHOLDS.gaming.comfortableDownload
      && upload >= EVALUATION_THRESHOLDS.gaming.comfortableUpload
      && (ping === null || ping <= EVALUATION_THRESHOLDS.gaming.comfortablePing)
    const available = download >= EVALUATION_THRESHOLDS.gaming.availableDownload
      && upload >= EVALUATION_THRESHOLDS.gaming.availableUpload
      && (ping === null || ping <= EVALUATION_THRESHOLDS.gaming.availablePing)
    gamingLevel = comfortable ? 'comfortable' : available ? 'available' : 'difficult'
  }

  const fileLevel = upload === null
    ? null
    : basicLevel(
      upload,
      EVALUATION_THRESHOLDS.fileUpload.comfortableUpload,
      EVALUATION_THRESHOLDS.fileUpload.availableUpload,
    )

  return [
    browsingLevel === null ? unavailable('browsing', 'Web閲覧・SNS') : {
      id: 'browsing', label: 'Web閲覧・SNS', level: browsingLevel,
      detail: browsingLevel === 'difficult' ? '画像の多いページでは待つ可能性があります' : '日常的な閲覧の目安',
    },
    videoLevel === null ? unavailable('video', '動画視聴') : {
      id: 'video', label: '動画視聴', level: videoLevel,
      detail: videoLevel === 'available' ? '画質によっては利用可能' : '動画再生の目安',
    },
    meetingLevel === null ? unavailable('meeting', 'Web会議') : {
      id: 'meeting', label: 'Web会議', level: meetingLevel,
      detail: ping === null ? '速度を基にした参考評価' : '送受信速度と応答時間の目安',
    },
    gamingLevel === null ? unavailable('gaming', 'オンラインゲーム') : {
      id: 'gaming', label: 'オンラインゲーム', level: gamingLevel,
      detail: ping === null ? '速度のみの参考評価' : '速度と応答時間の目安',
    },
    fileLevel === null ? unavailable('file-upload', '大容量ファイル送信') : {
      id: 'file-upload', label: '大容量ファイル送信', level: fileLevel,
      detail: 'アップロード速度を基にした目安',
    },
  ]
}

export interface MeasurementCommentResult {
  status: 'good' | 'notice' | 'limited' | 'unknown'
  title: string
  message: string
  suggestions: string[]
}

export const generateMeasurementComment = (
  result: MeasurementInput,
): MeasurementCommentResult => {
  const download = toValidMetric(result.downloadMbps)
  const upload = toValidMetric(result.uploadMbps)
  const ping = result.pingMs === null ? null : toValidMetric(result.pingMs)
  const pingInvalid = result.pingMs !== null && result.pingMs !== undefined && ping === null

  if (download === null || upload === null || pingInvalid) {
    return {
      status: 'unknown',
      title: '十分な評価ができませんでした',
      message: '一部の測定値を取得できなかったため、十分な評価ができませんでした。時間を置いて再測定してください。',
      suggestions: ['同じ場所でもう一度測定する'],
    }
  }

  const lowDownload = download < 25
  const lowUpload = upload < 5
  const highPing = ping !== null && ping > 80

  if (!lowDownload && !lowUpload && !highPing) {
    return {
      status: 'good',
      title: '今回の測定値は良好です',
      message: '今回の測定値では、一般的なWeb閲覧、動画視聴、Web会議で明確な不足は見当たりません。',
      suggestions: ['別の時間帯でも測定して比較する'],
    }
  }

  const messages: string[] = []
  if (lowDownload) messages.push('ダウンロード速度が低めです。高画質動画や大容量ダウンロードでは時間がかかる可能性があります。')
  if (lowUpload) messages.push('アップロード速度が低めです。大容量ファイルの送信やクラウド保存では時間がかかる可能性があります。')
  if (highPing) messages.push('応答時間が長めです。オンラインゲームやリアルタイム通話では遅延を感じる可能性があります。')

  return {
    status: messages.length > 1 ? 'limited' : 'notice',
    title: messages.length > 1 ? '複数の測定値が低めです' : '確認したい測定値があります',
    message: messages.join(' '),
    suggestions: ['別の時間帯でも測定して比較する', '体感と異なる場合は別端末でも測定する'],
  }
}
