import {
  summarizeMeasurementsByCondition,
  type MetricSummary,
} from '../lib/measurementHistoryAnalysis'
import { normalizeConditionLabel } from '../lib/measurementValidation'
import { formatFinalSpeedDisplay } from '../lib/speedValue'
import type { SpeedMeasurementResult } from '../types/measurement'
import { formatMilliseconds } from '../utils/formatMetric'

interface MeasurementConditionTrendProps {
  history: readonly SpeedMeasurementResult[]
  currentResult?: SpeedMeasurementResult | null
}

const QUALITY_LABELS: Record<MetricSummary['quality'], string> = {
  none: '未測定',
  reference: '参考値',
  trend: '傾向',
}

const formatMetricValue = (
  summary: MetricSummary,
  unit: 'Mbps' | 'ms',
): string => {
  if (summary.median === null) return '—'
  return unit === 'Mbps'
    ? `${formatFinalSpeedDisplay(summary.median)} Mbps`
    : `${formatMilliseconds(summary.median)} ms`
}

const ConditionMetric = ({
  label,
  summary,
  unit,
}: {
  label: string
  summary: MetricSummary
  unit: 'Mbps' | 'ms'
}) => (
  <div className="condition-trends__metric">
    <dt>{label}</dt>
    <dd>
      <strong>{formatMetricValue(summary, unit)}</strong>
      <small>n={summary.sampleCount}・{QUALITY_LABELS[summary.quality]}</small>
    </dd>
  </div>
)

export const MeasurementConditionTrend = ({
  history,
  currentResult,
}: MeasurementConditionTrendProps) => {
  const analysis = summarizeMeasurementsByCondition(history)
  const currentConditionLabel = normalizeConditionLabel(currentResult?.conditionLabel)

  if (analysis.labeledMeasurementCount < 2) return null

  return (
    <section className="measurement-condition-trends" aria-labelledby="condition-trends-title">
      <div className="measurement-history__time-band-heading">
        <h4 id="condition-trends-title">測定条件ごとの傾向</h4>
        <p>
          同じ条件の結果を中央値でまとめます。時間帯や回線状況でも変動するため、条件だけが原因とは限りません。
        </p>
      </div>
      {analysis.hasMoreConditions && (
        <p className="condition-trends__limit-note">直近5条件を表示しています。</p>
      )}
      <div className="condition-trends__table">
        <div className="condition-trends__columns" aria-hidden="true">
          <span>測定条件</span>
          <span>Download</span>
          <span>Upload</span>
          <span>Ping</span>
          <span>混雑時増加</span>
        </div>
        {analysis.summaries.map((summary) => {
          const isCurrent = currentConditionLabel === summary.conditionLabel
          return (
            <article className="condition-trends__row" key={summary.conditionLabel}>
              <div className="condition-trends__condition">
                <h5>{summary.conditionLabel}</h5>
                {isCurrent && <span className="condition-trends__current-badge">今回</span>}
                <p>{summary.totalMeasurements}回測定</p>
              </div>
              <dl className="condition-trends__metrics">
                <ConditionMetric label="Download" summary={summary.downloadMbps} unit="Mbps" />
                <ConditionMetric label="Upload" summary={summary.uploadMbps} unit="Mbps" />
                <ConditionMetric label="Ping" summary={summary.pingMs} unit="ms" />
                <ConditionMetric label="混雑時増加" summary={summary.loadedLatencyIncreaseMs} unit="ms" />
              </dl>
            </article>
          )
        })}
      </div>
    </section>
  )
}
