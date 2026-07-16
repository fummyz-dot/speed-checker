import { Brand } from './components/Brand'
import { ConnectionInfo } from './components/ConnectionInfo'
import { MeasurementStatus } from './components/MeasurementStatus'
import { MetricsGrid } from './components/MetricsGrid'
import { Notice } from './components/Notice'
import { useSpeedTest } from './hooks/useSpeedTest'
import { formatSpeed } from './utils/formatMetric'

function App() {
  const { metrics, phase, isRunning, error, start } = useSpeedTest()
  const hasStarted = phase !== 'idle'
  const buttonLabel = isRunning
    ? '測定中…'
    : phase === 'complete' || phase === 'error'
      ? 'もう一度測定'
      : '測定開始'

  return (
    <div className="site-shell">
      <header className="site-header">
        <Brand />
        <span className="site-header__tag">Network performance test</span>
      </header>

      <main>
        <section className="hero" aria-labelledby="page-title">
          <div className="hero__eyebrow">YOUR CONNECTION</div>
          <h1 id="page-title">インターネット速度を、シンプルに。</h1>
          <p className="hero__lead">
            現在の回線品質をCloudflareのエッジネットワークで測定します。
          </p>

          <ConnectionInfo />

          <div className="speed-display" aria-label="ダウンロード速度">
            <span className="speed-display__label">DOWNLOAD</span>
            <div className="speed-display__reading" aria-live="polite">
              <strong>{formatSpeed(metrics.download)}</strong>
              <span>Mbps</span>
            </div>
          </div>

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
            onClick={start}
            disabled={isRunning}
            aria-describedby="test-button-hint"
          >
            <span>{buttonLabel}</span>
            {!isRunning && <span aria-hidden="true">→</span>}
          </button>
          <p className="button-hint" id="test-button-hint">
            {hasStarted
              ? 'Wi-Fiや回線の状態により、結果は変動します'
              : '測定には数十秒かかる場合があります'}
          </p>
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
