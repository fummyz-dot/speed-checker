import type { TestPhase } from '../types/speedTest'

const phaseLabels: Record<TestPhase, string> = {
  idle: '準備完了',
  latency: 'ネットワークの応答を確認中',
  download: 'ダウンロード速度を測定中',
  upload: 'アップロード速度を測定中',
  complete: '測定が完了しました',
  error: '測定を完了できませんでした',
}

interface MeasurementStatusProps {
  phase: TestPhase
  isRunning: boolean
}

export const MeasurementStatus = ({
  phase,
  isRunning,
}: MeasurementStatusProps) => (
  <div className="measurement-status" role="status" aria-live="polite">
    <span
      className={`status-dot${isRunning ? ' status-dot--active' : ''}`}
      aria-hidden="true"
    />
    {phaseLabels[phase]}
  </div>
)

