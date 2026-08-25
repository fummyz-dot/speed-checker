import {
  getRecentMeasurementTrend,
  summarizeMeasurementsByTimeBand,
  type MetricSummary,
  type MeasurementTrendPoint,
  type TimeBandSummary,
} from '../lib/measurementHistoryAnalysis'
import { toValidTimezoneOffsetMinutes } from '../lib/measurementValidation'
import { formatFinalSpeedDisplay } from '../lib/speedValue'
import { formatMilliseconds } from '../utils/formatMetric'
import type { SpeedMeasurementResult } from '../types/measurement'
import { MeasurementConditionTrend } from './MeasurementConditionTrend'

interface MeasurementHistoryTrendProps {
  history: SpeedMeasurementResult[]
  currentResult?: SpeedMeasurementResult | null
}

interface ChartSeries {
  id: string
  label: string
  values: Array<number | null>
  valueLabel: (value: number | null) => string
}

const CHART_WIDTH = 640
const CHART_HEIGHT = 210
const CHART_PADDING = { top: 20, right: 18, bottom: 42, left: 42 }

const isChartValue = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value >= 0

const formatLoadedLatencyIncrease = (value: number | null): string =>
  value === null ? '—' : `${value.toLocaleString('ja-JP', { maximumFractionDigits: 1 })} ms`

const formatShortDate = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

const uniqueLabelIndices = (length: number): number[] => {
  const indices = [0, Math.floor((length - 1) / 2), length - 1]
  return [...new Set(indices)]
}

const legacyTimezoneOffsetFor = (measurement: SpeedMeasurementResult): number => {
  const storedOffset = toValidTimezoneOffsetMinutes(measurement.timezoneOffsetMinutes)
  if (storedOffset !== null) return storedOffset

  const measuredAt = new Date(measurement.measuredAt)
  return toValidTimezoneOffsetMinutes(measuredAt.getTimezoneOffset()) ?? 0
}

const formatMetricSummary = (
  summary: MetricSummary,
  unit: 'Mbps' | 'ms',
): string => {
  if (summary.median === null) return '—'
  if (unit === 'Mbps') return `${formatFinalSpeedDisplay(summary.median)} Mbps`
  return `${formatMilliseconds(summary.median)} ms`
}

const MetricValue = ({
  label,
  summary,
  unit,
  measurementCount,
}: {
  label: string
  summary: MetricSummary
  unit: 'Mbps' | 'ms'
  measurementCount: number
}) => (
  <div className="time-band-card__metric">
    <dt>{label}</dt>
    <dd>
      <strong>{formatMetricSummary(summary, unit)}</strong>
      {(summary.sampleCount !== measurementCount || summary.quality === 'reference') && (
        <small>
          {summary.sampleCount !== measurementCount ? `${summary.sampleCount}回` : ''}
          {summary.sampleCount !== measurementCount && summary.quality === 'reference' ? '・' : ''}
          {summary.quality === 'reference' ? '参考値' : ''}
        </small>
      )}
    </dd>
  </div>
)

const TimeBandCard = ({ summary }: { summary: TimeBandSummary }) => (
  <article className="time-band-card">
    <div className="time-band-card__heading">
      <h5>{summary.label}</h5>
      <span>{summary.measurementCount === 0 ? '未測定' : `${summary.measurementCount}回測定`}</span>
    </div>
    {summary.measurementCount === 0 ? (
      <p className="time-band-card__empty">この時間帯の測定結果はありません。</p>
    ) : (
      <dl>
        <MetricValue label="Download" summary={summary.downloadMbps} unit="Mbps" measurementCount={summary.measurementCount} />
        <MetricValue label="Upload" summary={summary.uploadMbps} unit="Mbps" measurementCount={summary.measurementCount} />
        <MetricValue label="Ping" summary={summary.pingMs} unit="ms" measurementCount={summary.measurementCount} />
        <MetricValue
          label="負荷時の増加"
          summary={summary.loadedLatencyIncreaseMs}
          unit="ms"
          measurementCount={summary.measurementCount}
        />
      </dl>
    )}
  </article>
)

const HistoryLineChart = ({
  title,
  unit,
  points,
  series,
}: {
  title: string
  unit: string
  points: MeasurementTrendPoint[]
  series: ChartSeries[]
}) => {
  const chartWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right
  const chartHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom
  const maximumValue = Math.max(0, ...series.flatMap(({ values }) => values.filter(isChartValue)))
  const yMaximum = maximumValue > 0 ? maximumValue * 1.1 : 1
  const xForIndex = (index: number): number => CHART_PADDING.left + (chartWidth * index) / (points.length - 1)
  const yForValue = (value: number): number => CHART_PADDING.top + chartHeight - (value / yMaximum) * chartHeight
  const pathForValues = (values: Array<number | null>): string => {
    let hasPreviousPoint = false
    return values.reduce<string>((path, value, index) => {
      if (!isChartValue(value)) {
        hasPreviousPoint = false
        return path
      }
      const command = hasPreviousPoint ? 'L' : 'M'
      hasPreviousPoint = true
      return `${path}${command}${xForIndex(index).toFixed(2)} ${yForValue(value).toFixed(2)} `
    }, '')
  }
  const latestIndex = points.length - 1
  const labelIndices = uniqueLabelIndices(points.length)

  return (
    <section className="history-chart" aria-labelledby={`${title}-chart-title`}>
      <div className="history-chart__heading">
        <h4 id={`${title}-chart-title`}>{title}</h4>
        <span>{unit}</span>
      </div>
      <ul className="history-chart__legend" aria-label={`${title}の凡例`}>
        {series.map((item) => (
          <li key={item.id}>
            <span className={`history-chart__legend-mark history-chart__legend-mark--${item.id}`} aria-hidden="true" />
            <span>{item.label}</span>
            <strong>{item.valueLabel(item.values[latestIndex])}</strong>
          </li>
        ))}
      </ul>
      <svg
        className="history-chart__svg"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-labelledby={`${title}-chart-svg-title ${title}-chart-svg-description`}
      >
        <title id={`${title}-chart-svg-title`}>{title}</title>
        <desc id={`${title}-chart-svg-description`}>直近{points.length}回の測定を古い順に表示しています。</desc>
        <g className="history-chart__grid" aria-hidden="true">
          {[0, 0.5, 1].map((ratio) => {
            const y = CHART_PADDING.top + chartHeight * ratio
            return <line key={ratio} x1={CHART_PADDING.left} x2={CHART_WIDTH - CHART_PADDING.right} y1={y} y2={y} />
          })}
          <line x1={CHART_PADDING.left} x2={CHART_PADDING.left} y1={CHART_PADDING.top} y2={CHART_PADDING.top + chartHeight} />
          <text x={CHART_PADDING.left - 7} y={CHART_PADDING.top + 4} textAnchor="end">{yMaximum.toFixed(0)}</text>
          <text x={CHART_PADDING.left - 7} y={CHART_PADDING.top + chartHeight + 4} textAnchor="end">0</text>
        </g>
        {series.map((item) => {
          const path = pathForValues(item.values)
          return path ? (
            <path
              className={`history-chart__line history-chart__line--${item.id}`}
              d={path}
              data-history-line={item.id}
              fill="none"
              key={item.id}
            />
          ) : null
        })}
        {series.flatMap((item) => item.values.map((value, index) => {
          if (!isChartValue(value)) return null
          const latest = index === latestIndex
          return (
            <circle
              className={`history-chart__point history-chart__point--${item.id}${latest ? ' history-chart__point--latest' : ''}`}
              cx={xForIndex(index)}
              cy={yForValue(value)}
              data-history-latest={latest}
              data-history-point={item.id}
              key={`${item.id}-${points[index].id}`}
              r={latest ? 4.5 : 3}
            />
          )
        }))}
        <g className="history-chart__x-labels" aria-hidden="true">
          {labelIndices.map((index) => (
            <text key={points[index].id} x={xForIndex(index)} y={CHART_HEIGHT - 12} textAnchor="middle">
              {formatShortDate(points[index].measuredAt)}
            </text>
          ))}
        </g>
      </svg>
    </section>
  )
}

export const MeasurementHistoryTrend = ({ history, currentResult }: MeasurementHistoryTrendProps) => {
  const trend = getRecentMeasurementTrend(history)
  const timeBandSummaries = summarizeMeasurementsByTimeBand(history.map((measurement) => ({
    measurement,
    timezoneOffsetMinutes: legacyTimezoneOffsetFor(measurement),
  })))
  const hasLegacyTimezone = history.some((measurement) => measurement.timezoneOffsetMinutes === undefined)

  return (
    <section className="result-panel measurement-history" aria-labelledby="history-title">
      <div className="result-panel__heading">
        <div>
          <span className="result-panel__eyebrow">MEASUREMENT HISTORY</span>
          <h3 id="history-title">測定履歴</h3>
        </div>
      </div>
      {trend.length < 2 ? (
        <p className="measurement-history__empty">あと1回以上測定すると、回線品質の変化を確認できます。</p>
      ) : (
        <div className="measurement-history__charts">
          <HistoryLineChart
            points={trend}
            series={[
              {
                id: 'download',
                label: 'Download',
                values: trend.map(({ downloadMbps }) => downloadMbps),
                valueLabel: (value) => `${formatFinalSpeedDisplay(value)} Mbps`,
              },
              {
                id: 'upload',
                label: 'Upload',
                values: trend.map(({ uploadMbps }) => uploadMbps),
                valueLabel: (value) => `${formatFinalSpeedDisplay(value)} Mbps`,
              },
            ]}
            title="速度の推移"
            unit="Mbps"
          />
          <HistoryLineChart
            points={trend}
            series={[
              {
                id: 'ping',
                label: 'Ping',
                values: trend.map(({ pingMs }) => pingMs),
                valueLabel: (value) => value === null ? '—' : `${formatMilliseconds(value)} ms`,
              },
              {
                id: 'loaded-latency',
                label: '負荷時の増加',
                values: trend.map(({ loadedLatencyIncreaseMs }) => loadedLatencyIncreaseMs),
                valueLabel: formatLoadedLatencyIncrease,
              },
            ]}
            title="応答性の推移"
            unit="ms"
          />
        </div>
      )}
      <MeasurementConditionTrend history={history} currentResult={currentResult} />
      <section className="measurement-history__time-bands" aria-labelledby="time-band-title">
        <div className="measurement-history__time-band-heading">
          <h4 id="time-band-title">時間帯別の傾向</h4>
          <p>各時間帯の測定結果の中央値です。1〜2回の測定は参考値として表示します。</p>
        </div>
        <div className="time-band-grid">
          {timeBandSummaries.map((summary) => <TimeBandCard key={summary.id} summary={summary} />)}
        </div>
        {hasLegacyTimezone && (
          <p className="measurement-history__legacy-timezone">一部の過去履歴は現在のタイムゾーンを基準に分類しています。</p>
        )}
      </section>
      <p className="result-note">履歴は過去の変化を確認するための表示です。現在の測定結果や判定を補正するものではありません。</p>
    </section>
  )
}
