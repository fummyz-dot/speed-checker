import type { SpeedMeasurementResult } from '../types/measurement'
import { compareMeasurements, type MetricComparison } from '../lib/measurementStorage'

interface PreviousMeasurementComparisonProps {
  current: SpeedMeasurementResult
  previous: SpeedMeasurementResult | null
  onClear: () => void
}

const formatPreviousDate = (value: string): string => new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value))

const ComparisonRow = ({
  label,
  comparison,
  unit,
  lowerIsBetter = false,
}: {
  label: string
  comparison: MetricComparison
  unit: string
  lowerIsBetter?: boolean
}) => {
  if (comparison.direction === 'unknown' || comparison.difference === null) {
    return <li><span>{label}</span><strong>比較不可</strong></li>
  }
  if (comparison.direction === 'same') {
    return <li><span>{label}</span><strong><span aria-hidden="true">→</span> ほぼ同じ</strong></li>
  }

  const improved = lowerIsBetter
    ? comparison.direction === 'down'
    : comparison.direction === 'up'
  const directionText = lowerIsBetter
    ? comparison.direction === 'down' ? '短縮' : '増加'
    : comparison.direction === 'up' ? '上昇' : '低下'
  const difference = Math.abs(comparison.difference)
  const percentage = comparison.percentage === null
    ? ''
    : `（${Math.abs(comparison.percentage).toFixed(1)}%）`

  return (
    <li>
      <span>{label}</span>
      <strong className={improved ? 'comparison--better' : 'comparison--worse'}>
        <span aria-hidden="true">{comparison.direction === 'up' ? '↑' : '↓'}</span>{' '}
        前回より{difference.toFixed(unit === 'ms' ? 0 : 1)}{unit}{directionText}{percentage}
      </strong>
    </li>
  )
}

export const PreviousMeasurementComparison = ({
  current,
  previous,
  onClear,
}: PreviousMeasurementComparisonProps) => {
  const comparison = previous ? compareMeasurements(current, previous) : null

  return (
    <section className="result-panel" aria-labelledby="comparison-title">
      <div className="result-panel__heading">
        <div>
          <span className="result-panel__eyebrow">PREVIOUS RESULT</span>
          <h3 id="comparison-title">前回測定との比較</h3>
        </div>
        <button className="text-button" type="button" onClick={onClear}>履歴を削除</button>
      </div>
      {previous && comparison ? (
        <>
          <p className="comparison-date">前回測定：{formatPreviousDate(previous.measuredAt)}</p>
          <ul className="comparison-list">
            <ComparisonRow label="ダウンロード" comparison={comparison.download} unit="Mbps" />
            <ComparisonRow label="アップロード" comparison={comparison.upload} unit="Mbps" />
            <ComparisonRow label="Ping" comparison={comparison.ping} unit="ms" lowerIsBetter />
          </ul>
        </>
      ) : (
        <p className="comparison-empty">比較できる前回結果がありません。次回の測定後に増減を確認できます。</p>
      )}
      <p className="result-note">同じ端末・ブラウザのLocalStorageに保存された結果との比較です。</p>
    </section>
  )
}
