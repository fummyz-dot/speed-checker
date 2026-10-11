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
      title: '通信中も反応は安定しています',
      message: '通信中も反応はほとんど遅くなっていません。',
    }
  }

  if (overall === 'unknown') {
    return {
      badge: '判定不可',
      title: '判定できませんでした',
      message: '必要な値が取れませんでした。もう一度測定してください。',
    }
  }

  const downloadAffected = download.level === 'notice' || download.level === 'poor'
  const uploadAffected = upload.level === 'notice' || upload.level === 'poor'
  const downloadIncrease = download.level === 'poor' ? '大きく遅くなっています' : '遅くなっています'
  const uploadIncrease = upload.level === 'poor' ? '大きく遅くなっています' : '遅くなっています'
  const poor = overall === 'poor'

  if (downloadAffected && uploadAffected) {
    const message = download.level === 'poor' && upload.level === 'poor'
      ? 'ダウンロード中もアップロード中も、反応が大きく遅くなっています。ほかの通信と重なると影響が出やすい状態です。'
      : `ダウンロード中は反応が${downloadIncrease.replace('なっています', 'なり')}、アップロード中は${uploadIncrease}。ほかの通信と重なると影響が出やすい状態です。`
    return {
      badge: poor ? '要注意' : '注意',
      title: poor ? '通信中に反応が大きく遅くなります' : '通信中に反応が遅くなります',
      message,
    }
  }

  if (downloadAffected) {
    return {
      badge: poor ? '要注意' : '注意',
      title: poor ? '通信中に反応が大きく遅くなります' : '通信中に反応が遅くなります',
      message: `ダウンロード中に反応が${downloadIncrease}。ほかの通信と重なると遅れを感じるかもしれません。`,
    }
  }

  return {
    badge: poor ? '要注意' : '注意',
    title: poor ? '通信中に反応が大きく遅くなります' : '通信中に反応が遅くなります',
    message: `アップロード中に反応が${uploadIncrease}。Web会議やゲームに影響するかもしれません。`,
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
          <h3 id="loaded-latency-title">通信中の反応</h3>
        </div>
        <span className={`loaded-latency__badge loaded-latency__badge--${evaluation.overall}`}>{summary.badge}</span>
      </div>
      <p className="loaded-latency__lead">通信中に、反応がどれだけ遅くなったかを見ています。</p>

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
          <LatencyRow label="基本の遅延（Ping）" loadedLatencyMs={toValidMetric(result.pingMs)} increaseMs={null} />
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
      <a className="result-guide-link" href="/loaded-latency/">負荷時遅延の判定基準を見る</a>
    </section>
  )
}
