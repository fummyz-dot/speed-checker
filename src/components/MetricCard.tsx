interface MetricCardProps {
  label: string
  value: string
  unit: string
  accent?: boolean
}

export const MetricCard = ({ label, value, unit, accent }: MetricCardProps) => (
  <div className={`metric-card${accent ? ' metric-card--accent' : ''}`}>
    <dt>{label}</dt>
    <dd>
      <span>{value}</span>
      <small>{unit}</small>
    </dd>
  </div>
)

