import {
  evaluateLoadedLatencyResponsiveness,
  type LoadedLatencyDirectionResult,
  type LoadedLatencyLevel,
} from '../lib/loadedLatencyEvaluation'
import { toValidMetric } from '../lib/measurementValidation'
import type { SpeedMeasurementResult } from '../types/measurement'

interface LoadedLatencyResponsivenessProps {
  result: SpeedMeasurementResult
}

const DIRECTION_LABELS: Record<LoadedLatencyLevel, string> = {
  good: '増加は小さい',
  notice: '増加が見られる',
  poor: '大きく増加',
  unknown: '判定不可',
}

const formatLatency = (value: unknown): string => {
  const latency = toValidMetric(value)
  return latency === null
    ? '—'
    : latency.toLocaleString('ja-JP', { maximumFractionDigits: 3 })
}

const formatIncrease = (increaseMs: number | null): string => {
  if (increaseMs === null) return '—'
  if (increaseMs === 0) return '増加なし'
  return `+${formatLatency(increaseMs)} ms`
}

const responsivenessMessage = (
  overall: LoadedLatencyLevel,
  download: LoadedLatencyDirectionResult,
  upload: LoadedLatencyDirectionResult,
): { badge: string; title: string; message: string } => {
  if (overall === 'good') {
    return {
      badge: '良好',
      title: '負荷がかかっても安定しています',
      message: '負荷がかかっても応答時間の増加は小さく、今回の測定では負荷による遅延の悪化は目立ちません。',
    }
  }

  if (overall === 'unknown') {
    return {
      badge: '判定不可',
      title: '混雑時の応答性を判定できませんでした',
      message: '比較に必要な応答時間を取得できなかったため、今回の測定では判定できませんでした。時間を置いて再測定してください。',
    }
  }

  const downloadAffected = download.level === 'notice' || download.level === 'poor'
  const uploadAffected = upload.level === 'notice' || upload.level === 'poor'
  const downloadIncrease = download.level === 'poor' ? '大きく増えています' : '増えています'
  const uploadIncrease = upload.level === 'poor' ? '大きく増えています' : '増えています'
  const poor = overall === 'poor'

  if (downloadAffected && uploadAffected) {
    const message = download.level === 'poor' && upload.level === 'poor'
      ? 'ダウンロード・アップロードのどちらでも応答時間が大きく増えています。同じ回線で複数の通信を行う場合は影響が出る可能性があります。'
      : `ダウンロード中に応答時間が${downloadIncrease}。アップロード中に応答時間が${uploadIncrease}。同じ回線で複数の通信を行う場合は影響が出る可能性があります。`
    return {
      badge: poor ? '要注意' : '注意',
      title: poor ? '負荷時に応答時間が大きく増えています' : '負荷時に応答時間が増えています',
      message,
    }
  }

  if (downloadAffected) {
    return {
      badge: poor ? '要注意' : '注意',
      title: poor ? '負荷時に応答時間が大きく増えています' : '負荷時に応答時間が増えています',
      message: `大容量ダウンロード中に応答時間が${downloadIncrease}。他の通信で遅延を感じる可能性があります。`,
    }
  }

  return {
    badge: poor ? '要注意' : '注意',
    title: poor ? '負荷時に応答時間が大きく増えています' : '負荷時に応答時間が増えています',
    message: `大容量アップロード中に応答時間が${uploadIncrease}。Web会議やオンラインゲームなどのリアルタイム通信に影響する可能性があります。`,
  }
}

interface LatencyRowProps {
  label: string
  loadedLatencyMs: number | null
  increaseMs: number | null
  level?: LoadedLatencyLevel
}

const LatencyRow = ({ label, loadedLatencyMs, increaseMs, level }: LatencyRowProps) => (
  <tr>
    <th scope="row">{label}</th>
    <td data-label="応答時間">
      <span className="loaded-latency__value">{formatLatency(loadedLatencyMs)}{loadedLatencyMs !== null && ' ms'}</span>
    </td>
    <td data-label="増加">
      <span className="loaded-latency__increase">{formatIncrease(increaseMs)}</span>
    </td>
    <td data-label="判定">
      {level ? <span className={`loaded-latency__level loaded-latency__level--${level}`}>{DIRECTION_LABELS[level]}</span> : '比較の基準'}
    </td>
  </tr>
)

export const LoadedLatencyResponsiveness = ({ result }: LoadedLatencyResponsivenessProps) => {
  const evaluation = evaluateLoadedLatencyResponsiveness({
    idleLatencyMs: result.pingMs,
    downloadLoadedLatencyMs: result.downloadLoadedLatencyMs,
    uploadLoadedLatencyMs: result.uploadLoadedLatencyMs,
  })
  const summary = responsivenessMessage(evaluation.overall, evaluation.download, evaluation.upload)

  return (
    <section className={`result-panel loaded-latency loaded-latency--${evaluation.overall}`} aria-labelledby="loaded-latency-title">
      <div className="result-panel__heading">
        <div>
          <span className="result-panel__eyebrow">LOADED LATENCY</span>
          <h3 id="loaded-latency-title">混雑時の応答性</h3>
        </div>
        <span className={`loaded-latency__badge loaded-latency__badge--${evaluation.overall}`}>{summary.badge}</span>
      </div>
      <p className="loaded-latency__lead">回線使用中に応答時間がどれだけ増えるかを確認します</p>

      <table className="loaded-latency__table">
        <thead>
          <tr>
            <th scope="col">測定時</th>
            <th scope="col">応答時間</th>
            <th scope="col">増加</th>
            <th scope="col">判定</th>
          </tr>
        </thead>
        <tbody>
          <LatencyRow label="アイドル時" loadedLatencyMs={toValidMetric(result.pingMs)} increaseMs={null} />
          <LatencyRow
            label="ダウンロード中"
            loadedLatencyMs={evaluation.download.loadedLatencyMs}
            increaseMs={evaluation.download.increaseMs}
            level={evaluation.download.level}
          />
          <LatencyRow
            label="アップロード中"
            loadedLatencyMs={evaluation.upload.loadedLatencyMs}
            increaseMs={evaluation.upload.increaseMs}
            level={evaluation.upload.level}
          />
        </tbody>
      </table>

      <div className="loaded-latency__summary">
        <h4>{summary.title}</h4>
        <p>{summary.message}</p>
      </div>
      {evaluation.isPartial && (
        <p className="loaded-latency__partial">一部の測定値を取得できなかったため、取得できた値のみで判定しています。</p>
      )}
      {evaluation.overall !== 'unknown' && (
        <p className="result-note">ネットワークの状態は時間帯や同時通信によって変動します。気になる場合は、同じ条件で2〜3回測定して傾向を確認してください。</p>
      )}
    </section>
  )
}
