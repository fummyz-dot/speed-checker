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
import type { RankingSubmissionResult } from './features/ranking/types'
import type { ShareRankingSummary } from './lib/sharePost'
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
  const [shareRanking, setShareRanking] = useState<ShareRankingSummary | null>(null)
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
        <span className="speed-display__label">下り</span>
        <div className="speed-display__reading" aria-live="polite">
          <strong>{displayedDownload}</strong>
          <span>Mbps</span>
        </div>
      </div>

      <div className="measurement-actions">
        <button
          className="test-button"
          type="button"
          onClick={startMeasurement}
          disabled={isRunning || isPreparingContext || isConditionEditing}
          aria-describedby="test-button-hint"
        >
          {buttonLabel}
        </button>
        <MeasurementStatus phase={phase} isRunning={isRunning} />
        <p className="button-hint" id="test-button-hint">
          {isConditionEditing
            ? '比較条件を確定またはキャンセルしてください'
            : hasStarted
            ? 'Wi-Fiや回線の状態により、結果は変動します'
            : '測定には数十秒かかる場合があります'}
        </p>

        {error && (
          <div className="error-message" role="alert">
            <strong>エラー</strong>
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  )
  const heroControls = [measurementControl, conditionSelector, connectionInfo]

  return (
    <div className={`site-shell${isRaceFocused ? ' site-shell--race-focused' : ''}`}>
      <header
        className="site-header"
        data-race-focus-background
        aria-hidden={isRaceFocused || undefined}
        inert={isRaceFocused}
      >
        <Brand />
        <nav className="site-header__nav" aria-label="主要ナビゲーション">
          <a href="/ranking/">全国ランキング</a>
          <a href="/guide/">回線品質ガイド</a>
          <a href="/methodology/">測定方法</a>
        </nav>
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
              <p className="hero__racecard"><span>本日のメインレース</span><span>回線速度ステークス</span><span>3頭立て</span></p>
              <h1 id="page-title"><span>回線速度を、</span><span>競馬で測る。</span></h1>
              <p className="hero__lead">
                あなたの回線が、下りの速さで走り、上りの速さで跳びます。
                <br className="hero__lead-mobile-break" />
                相手は地方馬と無敗の三冠馬。何着に入れるか確かめましょう。
              </p>
            </div>
            <div className="hero__intro-aside">
              {rankingEnabled && (
                <div className="hero-ranking-promo">
                  <div className="hero-ranking-promo__copy">
                    <strong>全国ランキング開催中</strong>
                    <span>測定後に参加すると、今日の順位がわかります。</span>
                  </div>
                </div>
              )}
              <div className="hero__summary" aria-label="測定でわかること">
                <strong>測定でわかること</strong>
                <ul>
                  <li><b>速度</b>ダウンロードとアップロード</li>
                  <li><b>応答性</b>Ping、Jitter、通信中の遅延</li>
                  <li><b>比較</b>Wi-Fiと有線、部屋、時間帯の違い</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="hero__dashboard">
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

            <div
              className="hero__controls"
              data-race-focus-background
              aria-hidden={isRaceFocused || undefined}
              inert={isRaceFocused}
            >
              {heroControls}
            </div>
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
                onSubmitted={(submission: RankingSubmissionResult) => setShareRanking({
                  measurementId: completedResult.id,
                  rank: submission.entry.rank,
                  tieCount: submission.entry.tieCount,
                  totalRuns: submission.entry.totalRuns,
                  scoreTenths: submission.entry.scoreTenths,
                })}
              />
            </div>
          )}
        </section>

        <section
          className={`results${hasStarted ? '' : ' results--idle'}`}
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
            <CompletedMeasurement result={completedResult} ranking={shareRanking} />
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
