import { useCallback, useEffect, useRef, useState } from 'react'
import { Brand } from './components/Brand'
import { CompletedMeasurement } from './components/CompletedMeasurement'
import { ConnectionInfo } from './components/ConnectionInfo'
import { HorseSpeedVisualization } from './components/HorseSpeedVisualization'
import { MeasurementStatus } from './components/MeasurementStatus'
import { MeasurementConditionSelector } from './components/MeasurementConditionSelector'
import { MetricsGrid } from './components/MetricsGrid'
import { Notice } from './components/Notice'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useSpeedTest } from './hooks/useSpeedTest'
import {
  bandwidthBitsToMbps,
  formatFinalSpeedDisplay,
} from './lib/speedValue'
import { loadMeasurements } from './lib/measurementStorage'
import { normalizeConditionLabel } from './lib/measurementValidation'

const getInitialConditionLabel = (): string | null =>
  normalizeConditionLabel(loadMeasurements()[0]?.conditionLabel)

const RACE_FOCUS_TRANSITION_MS = 200

interface RaceFocusExitRequest {
  shouldRestoreFocus: boolean
  afterExit?: () => void
}

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
  const isMobileLayout = useMediaQuery('(max-width: 760px)')
  const [conditionLabel, setConditionLabel] = useState<string | null>(getInitialConditionLabel)
  const [isConditionEditing, setIsConditionEditing] = useState(false)
  const [isRaceFocused, setIsRaceFocused] = useState(false)
  const [isRaceFocusExiting, setIsRaceFocusExiting] = useState(false)
  const focusReturnTargetRef = useRef<HTMLElement | null>(null)
  const raceFocusExitTimerRef = useRef<number | null>(null)
  const pendingRaceFocusExitRef = useRef<RaceFocusExitRequest | null>(null)
  const displayedDownload = formatFinalSpeedDisplay(confirmedDownloadMbps)
  const hasStarted = phase !== 'idle'
  const buttonLabel = isRunning
    ? '測定中…'
    : phase === 'complete' || phase === 'error'
      ? 'もう一度測定'
      : '測定開始'

  const requestRaceFocus = useCallback(() => {
    if (!isRaceFocused) {
      const activeElement = document.activeElement
      focusReturnTargetRef.current = activeElement instanceof HTMLElement ? activeElement : null
    }
    setIsRaceFocused(true)
  }, [isRaceFocused])

  const exitRaceFocus = useCallback((shouldRestoreFocus = true, afterExit?: () => void) => {
    if (!isRaceFocused) {
      afterExit?.()
      return
    }
    if (isRaceFocusExiting) return

    setIsRaceFocusExiting(true)
    raceFocusExitTimerRef.current = window.setTimeout(() => {
      raceFocusExitTimerRef.current = null
      pendingRaceFocusExitRef.current = { shouldRestoreFocus, afterExit }
      setIsRaceFocused(false)
      setIsRaceFocusExiting(false)
    }, RACE_FOCUS_TRANSITION_MS)
  }, [isRaceFocusExiting, isRaceFocused])

  const showMeasurementDetails = useCallback(() => {
    exitRaceFocus(false, () => {
      document.getElementById('measurement-results')?.scrollIntoView({ block: 'start' })
      document.getElementById('results-title')?.focus({ preventScroll: true })
    })
  }, [exitRaceFocus])

  useEffect(() => {
    if (!isRaceFocused) return
    document.documentElement.classList.add('race-focus-lock')
    document.body.classList.add('race-focus-lock')
    return () => {
      document.documentElement.classList.remove('race-focus-lock')
      document.body.classList.remove('race-focus-lock')
    }
  }, [isRaceFocused])

  useEffect(() => {
    if (isRaceFocused) return
    const exitRequest = pendingRaceFocusExitRef.current
    if (!exitRequest) return
    pendingRaceFocusExitRef.current = null

    exitRequest.afterExit?.()
    if (!exitRequest.shouldRestoreFocus) return
    const target = focusReturnTargetRef.current
    if (target?.isConnected && !target.matches(':disabled')) {
      target.focus()
      return
    }
    if (!isMobileLayout) {
      document.querySelector<HTMLElement>('[data-race-focus-expand]')?.focus()
    }
  }, [isMobileLayout, isRaceFocused])

  useEffect(() => () => {
    if (raceFocusExitTimerRef.current !== null) {
      window.clearTimeout(raceFocusExitTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (phase === 'error') exitRaceFocus()
  }, [exitRaceFocus, phase])

  const startMeasurement = () => {
    if (isConditionEditing) return
    requestRaceFocus()
    start({ conditionLabel })
  }

  const connectionInfo = <ConnectionInfo key="connection-info" />
  const conditionSelector = (
    <MeasurementConditionSelector
      key="measurement-condition"
      value={conditionLabel}
      disabled={isRunning}
      onChange={setConditionLabel}
      onEditingChange={setIsConditionEditing}
    />
  )
  const measurementControl = (
    <div className="hero__measurement" key="hero-measurement">
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
  )
  const heroControls = isMobileLayout
    ? [conditionSelector, measurementControl, connectionInfo]
    : [connectionInfo, conditionSelector, measurementControl]

  return (
    <div className={`site-shell${isRaceFocused ? ' site-shell--race-focused' : ''}`}>
      <header
        className="site-header"
        data-race-focus-background
        aria-hidden={isRaceFocused || undefined}
        inert={isRaceFocused}
      >
        <Brand />
        <span className="site-header__tag">Network performance test</span>
      </header>

      <main>
        <section className="hero" aria-labelledby="page-title">
          <div
            className="hero__intro"
            data-race-focus-background
            aria-hidden={isRaceFocused || undefined}
            inert={isRaceFocused}
          >
            <div className="hero__eyebrow">YOUR CONNECTION</div>
            <h1 id="page-title">インターネット速度を、シンプルに。</h1>
            <p className="hero__lead">
              現在の回線品質をCloudflareのエッジネットワークで測定します。
            </p>
          </div>

          <div className="hero__dashboard">
            <div
              className="hero__controls"
              data-race-focus-background
              aria-hidden={isRaceFocused || undefined}
              inert={isRaceFocused}
            >
              {heroControls}
            </div>

            <HorseSpeedVisualization
              downloadMbps={bandwidthBitsToMbps(metrics.download)}
              uploadMbps={bandwidthBitsToMbps(metrics.upload)}
              confirmedDownloadMbps={confirmedDownloadMbps}
              phase={phase}
              result={completedResult}
              focused={isRaceFocused}
              focusExiting={isRaceFocusExiting}
              showExpandButton={!isMobileLayout}
              showShrinkButton={!isMobileLayout}
              onRequestFocus={requestRaceFocus}
              onRequestExitFocus={exitRaceFocus}
              onShowDetails={showMeasurementDetails}
            />
          </div>
        </section>

        <section
          className="results"
          id="measurement-results"
          aria-labelledby="results-title"
          data-race-focus-background
          aria-hidden={isRaceFocused || undefined}
          inert={isRaceFocused}
        >
          <div className="section-heading">
            <div>
              <span>DETAILS</span>
              <h2 id="results-title" tabIndex={-1}>回線品質の詳細</h2>
            </div>
            <p>速度は高いほど、レイテンシとジッターは低いほど快適です。</p>
          </div>
          <MetricsGrid metrics={metrics} />
          {phase === 'complete' && completedResult && (
            <CompletedMeasurement result={completedResult} />
          )}
        </section>

        <div data-race-focus-background aria-hidden={isRaceFocused || undefined} inert={isRaceFocused}>
          <Notice />
        </div>
      </main>

      <footer
        className="site-footer"
        data-race-focus-background
        aria-hidden={isRaceFocused || undefined}
        inert={isRaceFocused}
      >
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
