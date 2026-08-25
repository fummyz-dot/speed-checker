import { useState } from 'react'
import { Brand } from './components/Brand'
import { CompletedMeasurement } from './components/CompletedMeasurement'
import { ConnectionInfo } from './components/ConnectionInfo'
import { HorseSpeedVisualization } from './components/HorseSpeedVisualization'
import { MeasurementStatus } from './components/MeasurementStatus'
import { MeasurementConditionSelector } from './components/MeasurementConditionSelector'
import { MetricsGrid } from './components/MetricsGrid'
import { Notice } from './components/Notice'
import { useSpeedTest } from './hooks/useSpeedTest'
import {
  bandwidthBitsToMbps,
  formatFinalSpeedDisplay,
} from './lib/speedValue'
import { loadMeasurements } from './lib/measurementStorage'
import { normalizeConditionLabel } from './lib/measurementValidation'

const getInitialConditionLabel = (): string | null =>
  normalizeConditionLabel(loadMeasurements()[0]?.conditionLabel)

function App() {
  const {
    metrics,
    phase,
    isRunning,
    error,
    completedResult,
    confirmedDownloadMbps,
    start,
  } = useSpeedTest()
  const [conditionLabel, setConditionLabel] = useState<string | null>(getInitialConditionLabel)
  const [isConditionEditing, setIsConditionEditing] = useState(false)
  const displayedDownload = formatFinalSpeedDisplay(confirmedDownloadMbps)
  const hasStarted = phase !== 'idle'
  const buttonLabel = isRunning
    ? '測定中…'
    : phase === 'complete' || phase === 'error'
      ? 'もう一度測定'
      : '測定開始'
  const startMeasurement = () => {
    if (isConditionEditing) return
    start({ conditionLabel })
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <Brand />
        <span className="site-header__tag">Network performance test</span>
      </header>

      <main>
        <section className="hero" aria-labelledby="page-title">
          <div className="hero__intro">
            <div className="hero__eyebrow">YOUR CONNECTION</div>
            <h1 id="page-title">インターネット速度を、シンプルに。</h1>
            <p className="hero__lead">
              現在の回線品質をCloudflareのエッジネットワークで測定します。
            </p>
          </div>

          <div className="hero__dashboard">
            <div className="hero__controls">
              <ConnectionInfo />

              <MeasurementConditionSelector
                value={conditionLabel}
                disabled={isRunning}
                onChange={setConditionLabel}
                onEditingChange={setIsConditionEditing}
              />

              <div className="hero__measurement">
                <div className="speed-display" aria-label="ダウンロード速度">
                  <span className="speed-display__label">DOWNLOAD</span>
                  <div className="speed-display__reading" aria-live="polite">
                    <strong>{displayedDownload}</strong>
                    <span>Mbps</span>
                  </div>
                </div>

                <div className="measurement-actions">
                  <MeasurementStatus phase={phase} isRunning={isRunning} />

                  {error && (
                    <div className="error-message" role="alert">
                      <strong>エラー</strong>
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    className="test-button"
                    type="button"
                    onClick={startMeasurement}
                    disabled={isRunning || isConditionEditing}
                    aria-describedby="test-button-hint"
                  >
                    <span>{buttonLabel}</span>
                    {!isRunning && <span aria-hidden="true">→</span>}
                  </button>
                  <p className="button-hint" id="test-button-hint">
                    {isConditionEditing
                      ? '測定条件を確定またはキャンセルしてください'
                      : hasStarted
                      ? 'Wi-Fiや回線の状態により、結果は変動します'
                      : '測定には数十秒かかる場合があります'}
                  </p>
                </div>
              </div>
            </div>

            <HorseSpeedVisualization
              downloadMbps={bandwidthBitsToMbps(metrics.download)}
              uploadMbps={bandwidthBitsToMbps(metrics.upload)}
              confirmedDownloadMbps={confirmedDownloadMbps}
              phase={phase}
              result={completedResult}
            />
          </div>
        </section>

        <section className="results" aria-labelledby="results-title">
          <div className="section-heading">
            <div>
              <span>DETAILS</span>
              <h2 id="results-title">回線品質の詳細</h2>
            </div>
            <p>速度は高いほど、レイテンシとジッターは低いほど快適です。</p>
          </div>
          <MetricsGrid metrics={metrics} />
          {phase === 'complete' && completedResult && (
            <CompletedMeasurement result={completedResult} />
          )}
        </section>

        <Notice />
      </main>

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} Speed Checker</span>
        <div className="site-footer__links">
          <a href="https://github.com/fummyz-dot/speed-checker" target="_blank" rel="noreferrer noopener">
            GitHubでソースコードを見る
          </a>
          <span>Powered by Cloudflare Speedtest</span>
        </div>
      </footer>
    </div>
  )
}

export default App
