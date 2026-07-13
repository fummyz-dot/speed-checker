import type { SpeedTestMetrics } from '../types/speedTest'
import { formatMilliseconds, formatSpeed } from '../utils/formatMetric'
import { MetricCard } from './MetricCard'

interface MetricsGridProps {
  metrics: SpeedTestMetrics
}

export const MetricsGrid = ({ metrics }: MetricsGridProps) => (
  <dl className="metrics-grid" aria-label="測定結果の詳細">
    <MetricCard
      label="アップロード"
      value={formatSpeed(metrics.upload)}
      unit="Mbps"
      accent
    />
    <MetricCard
      label="アイドル時レイテンシ"
      value={formatMilliseconds(metrics.latency)}
      unit="ms"
    />
    <MetricCard
      label="ジッター"
      value={formatMilliseconds(metrics.jitter)}
      unit="ms"
    />
    <MetricCard
      label="ダウンロード負荷時"
      value={formatMilliseconds(metrics.downloadLoadedLatency)}
      unit="ms"
    />
    <MetricCard
      label="アップロード負荷時"
      value={formatMilliseconds(metrics.uploadLoadedLatency)}
      unit="ms"
    />
  </dl>
)

