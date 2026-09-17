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
import { RankingCard } from './features/ranking/RankingCard'
import { isRankingEnabled } from './features/ranking/rankingFeature'
import { useRanking } from './features/ranking/useRanking'
import { consumeRunReturnContext } from './features/run/runReturnContext'
import {
  bandwidthBitsToMbps,
  formatFinalSpeedDisplay,
} from './lib/speedValue'
import { loadMeasurements, measurementResultToMetrics } from './lib/measurementStorage'
import type { SpeedMeasurementResult } from './types/measurement'
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
    start,
  } = useSpeedTest()
  const rankingEnabled = isRankingEnabled()
  const {
    context: rankingContext,
    championReference,
    isPreparingContext,
    service: rankingService,
    prepareMeasurement,
  } = useRanking(rankingEnabled)
  const isMobileLayout = useMediaQuery('(max-width: 760px)')
  const [conditionLabel, setConditionLabel] = useState<string | null>(getInitialConditionLabel)
  const [isConditionEditing, setIsConditionEditing] = useState(false)
  const [isRaceFocused, setIsRaceFocused] = useState(false)
  const [isRaceFocusExiting, setIsRaceFocusExiting] = useState(false)
  const [restoredResult, setRestoredResult] = useState<SpeedMeasurementResult | null>(null)
  const hasConsumedRunReturnRef = useRef(false)
  const focusReturnTargetRef = useRef<HTMLElement | null>(null)
  const raceFocusExitTimerRef = useRef<number | null>(null)
  const pendingRaceFocusExitRef = useRef<RaceFocusExitRequest | null>(null)
  const displayedDownloadMbps = phase === 'complete' && completedResult
    ? completedResult.downloadMbps
    : restoredResult?.downloadMbps ?? null
  const displayedMetrics = restoredResult
    ? measurementResultToMetrics(restoredResult)
    : metrics
  const displayedDownload = formatFinalSpeedDisplay(displayedDownloadMbps)
  const hasStarted = phase !== 'idle' || restoredResult !== null
  const buttonLabel = isPreparingContext
    ? '準備中…'
    : isRunning
    ? '測定中…'
    : phase === 'complete' || phase === 'error' || restoredResult !== null
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
      const rankingResults = rankingEnabled
        ? document.getElementById('ranking-results')
        : null
      if (rankingResults) {
        rankingResults.scrollIntoView({ block: 'start' })
        rankingResults.focus({ preventScroll: true })
        return
      }
      document.getElementById('measurement-results')?.scrollIntoView({ block: 'start' })
      document.getElementById('results-title')?.focus({ preventScroll: true })
    })
  }, [exitRaceFocus, rankingEnabled])

  useEffect(() => {
    if (hasConsumedRunReturnRef.current) return
    hasConsumedRunReturnRef.current = true
    const context = consumeRunReturnContext()
    if (!context) return
    const matchingResult = loadMeasurements().find(({ id }) => id === context.measurementId)
    if (matchingResult) setRestoredResult(matchingResult)
  }, [])

  useEffect(() => {
    if (!restoredResult) return
    const results = document.getElementById('measurement-results')
    results?.scrollIntoView({ block: 'start' })
    document.getElementById('results-title')?.focus({ preventScroll: true })
  }, [restoredResult])

  useEffect(() => {
    if (!isRaceFocused) return
    const staticContent = document.getElementById('home-static-content')
    document.documentElement.classList.add('race-focus-lock')
    document.body.classList.add('race-focus-lock')
    staticContent?.setAttribute('aria-hidden', 'true')
    staticContent?.setAttribute('inert', '')
    return () => {
      document.documentElement.classList.remove('race-focus-lock')
      document.body.classList.remove('race-focus-lock')
      staticContent?.removeAttribute('aria-hidden')
      staticContent?.removeAttribute('inert')
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
    if (isConditionEditing || isPreparingContext) return
    requestRaceFocus()
    if (!rankingEnabled) {
      setRestoredResult(null)
      start({ conditionLabel })
      return
    }
    void prepareMeasurement().then((shouldStart) => {
      if (shouldStart) {
        setRestoredResult(null)
        start({ conditionLabel })
      }
    })
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
        <span className="speed-display__label">ダウンロード</span>
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
          disabled={isRunning || isPreparingContext || isConditionEditing}
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
        <span className="site-header__tag">回線速度・品質測定</span>
      </header>

      <main>
        <section className="hero" aria-labelledby="page-title">
          <div
            className={`hero__intro${rankingEnabled ? ' hero__intro--with-ranking' : ''}`}
            data-race-focus-background
            aria-hidden={isRaceFocused || undefined}
            inert={isRaceFocused}
          >
            <div className="hero__intro-copy">
              <h1 id="page-title"><span>インターネット速度を、</span><wbr /><span>シンプルに。</span></h1>
              <p className="hero__lead">
                現在の回線品質をCloudflareの
                <br className="hero__lead-mobile-break" />
                エッジネットワークで測定します。
              </p>
            </div>
            {rankingEnabled && (
              <div className="hero-ranking-promo">
                <span className="hero-ranking-promo__eyebrow">全国順位表</span>
                <div className="hero-ranking-promo__copy">
                  <strong>全国ランキング開催中！</strong>
                  <span>あなたの回線は今日何位？ 測って確かめよう。</span>
                </div>
              </div>
            )}
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
              phase={phase}
              result={completedResult}
              championReference={championReference}
              showChampionReference={rankingEnabled}
              focused={isRaceFocused}
              focusExiting={isRaceFocusExiting}
              showExpandButton={!isMobileLayout}
              showShrinkButton={!isMobileLayout}
              onRequestFocus={requestRaceFocus}
              onRequestExitFocus={exitRaceFocus}
              onShowDetails={showMeasurementDetails}
            />
          </div>
          {phase === 'complete' && completedResult && rankingEnabled && (
            <div
              className="hero__ranking"
              id="ranking-results"
              tabIndex={-1}
              data-race-focus-background
              aria-hidden={isRaceFocused || undefined}
              inert={isRaceFocused}
            >
              <RankingCard
                context={rankingContext}
                service={rankingService}
                measurement={completedResult}
              />
            </div>
          )}
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
              <h2 id="results-title" tabIndex={-1}>回線品質の詳細</h2>
            </div>
            <p>
              {restoredResult
                ? 'Runで使用した測定結果を表示しています。'
                : '速度は高いほど、レイテンシとジッターは低いほど快適です。'}
            </p>
          </div>
          <MetricsGrid metrics={displayedMetrics} />
          {phase === 'complete' && completedResult && (
            <CompletedMeasurement result={completedResult} />
          )}
          {restoredResult && (
            <CompletedMeasurement result={restoredResult} persistResult={false} />
          )}
        </section>

        <div data-race-focus-background aria-hidden={isRaceFocused || undefined} inert={isRaceFocused}>
          <Notice />
        </div>
      </main>
    </div>
  )
}

export default App
