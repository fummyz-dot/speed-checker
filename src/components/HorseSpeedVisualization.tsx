import type { CSSProperties } from 'react'
import {
  GROUP_JUMP_DURATION_MS,
  useHorseRaceAnimation,
  WARMUP_DURATION_MS,
  WARMUP_MAX_PROGRESS,
  type HorseRaceState,
} from '../hooks/useHorseRaceAnimation'
import { useLiveSpeedDisplay } from '../hooks/useLiveSpeedDisplay'
import { getUserHorseJumpHeight } from '../lib/horseVisualization'
import { HORSE_RACE_LANES, type HorseId } from '../lib/horseRaceLanes'
import { formatFinalSpeedDisplay, formatLiveSpeedDisplay } from '../lib/speedValue'
import type { SpeedMeasurementResult } from '../types/measurement'
import type { TestPhase } from '../types/speedTest'
import { GoalFocusFrontView } from './GoalFocusFrontView'
import { HorseSprite } from './HorseSprite'

interface HorseSpeedVisualizationProps {
  downloadMbps: number | null
  uploadMbps: number | null
  confirmedDownloadMbps?: number | null
  phase: TestPhase
  result: SpeedMeasurementResult | null
}

type RaceStyle = CSSProperties & {
  '--standard-duration': string
  '--fast-duration': string
  '--user-duration': string
  '--user-jump-height': string
  '--race-start-progress': string
  '--warmup-duration': string
  '--warmup-max-progress': string
  '--group-jump-duration': string
}

const getHelperText = (state: HorseRaceState, hasUploadResult: boolean): string => {
  switch (state) {
    case 'idle': return '測定開始を待っています'
    case 'measuringDownload': return 'ダウンロード測定中…'
    case 'warmingUp': return 'ダウンロード測定中・ウォームアップ走行中…'
    case 'running': return hasUploadResult ? 'レース進行中' : 'レース進行中・アップロード測定中…'
    case 'waitingForAllFinish': return '先着馬はゴールで待機中…'
    case 'transitionToFrontView': return 'ALL RUNNERS FINISHED'
    case 'groupJumpFrontView': return 'GOAL!'
    case 'finished': return 'FINISH'
  }
}

export const HorseSpeedVisualization = ({
  downloadMbps,
  uploadMbps,
  confirmedDownloadMbps = null,
  phase,
  result,
}: HorseSpeedVisualizationProps) => {
  const {
    state,
    userRunDuration,
    referenceDurations,
    raceStartProgress,
    hasFinished,
    canReplay,
    replay,
  } = useHorseRaceAnimation({ phase, downloadMbps, result })
  const displayedDownload = result?.downloadMbps ?? confirmedDownloadMbps ?? downloadMbps
  const displayedUpload = result?.uploadMbps ?? uploadMbps
  const isLiveDownload = phase === 'download' && result === null && downloadMbps !== null
  const isLiveUpload = phase === 'upload' && result === null && uploadMbps !== null
  const animatedDownloadMbps = useLiveSpeedDisplay({
    actualMeasuredMbps: downloadMbps,
    finalMeasuredMbps: result?.downloadMbps ?? confirmedDownloadMbps,
    isMeasuring: isLiveDownload,
  })
  const animatedUploadMbps = useLiveSpeedDisplay({
    actualMeasuredMbps: uploadMbps,
    finalMeasuredMbps: result?.uploadMbps ?? null,
    isMeasuring: isLiveUpload,
  })
  const formattedDownload = isLiveDownload
    ? formatLiveSpeedDisplay(animatedDownloadMbps)
    : formatFinalSpeedDisplay(displayedDownload)
  const formattedUpload = isLiveUpload
    ? formatLiveSpeedDisplay(animatedUploadMbps)
    : formatFinalSpeedDisplay(displayedUpload)
  const raceStyle: RaceStyle = {
    '--standard-duration': `${referenceDurations.standard}s`,
    '--fast-duration': `${referenceDurations.fast}s`,
    '--user-duration': `${userRunDuration.toFixed(2)}s`,
    '--user-jump-height': `${getUserHorseJumpHeight(result?.uploadMbps ?? 0).toFixed(0)}px`,
    '--race-start-progress': `${(raceStartProgress * 100).toFixed(3)}%`,
    '--warmup-duration': `${WARMUP_DURATION_MS}ms`,
    '--warmup-max-progress': `${WARMUP_MAX_PROGRESS * 100}%`,
    '--group-jump-duration': `${GROUP_JUMP_DURATION_MS}ms`,
  }
  const raceIsActive = state === 'running' || state === 'waitingForAllFinish'
  const frontViewIsActive = state === 'transitionToFrontView'
    || state === 'groupJumpFrontView'
    || state === 'finished'
  const showUploadResult = result !== null
    && (state === 'groupJumpFrontView' || state === 'finished')
  const getRunnerStateClass = (horse: HorseId): string => {
    if (frontViewIsActive) return 'race-runner--finished'
    if (hasFinished[horse]) return 'race-runner--waiting'
    if (state === 'warmingUp') return 'race-runner--warming'
    return raceIsActive ? 'race-runner--racing' : 'race-runner--idle'
  }

  return (
    <section className="result-panel horse-visualization" aria-labelledby="horse-title">
      <div className="result-panel__heading">
        <div>
          <span className="result-panel__eyebrow">SPEED RACE</span>
          <h2 id="horse-title">回線速度レース</h2>
        </div>
        {showUploadResult && (
          <div className="race-upload-result" data-final-upload-result>
            <span>UPLOAD</span>
            <strong>{formatFinalSpeedDisplay(result.uploadMbps)}</strong>
            <small>Mbps</small>
          </div>
        )}
        <button className="secondary-button" type="button" onClick={replay} disabled={!canReplay}>
          もう一度見る
        </button>
      </div>

      <div
        className={`horse-course horse-course--${state}`}
        style={raceStyle}
        data-animation-state={state}
      >
        <span className="horse-course__helper" role="status" aria-live="polite">
          {getHelperText(state, Boolean(result))}
        </span>
        <div className="horse-course__track" aria-hidden={frontViewIsActive}>
          <span className="horse-course__start">START</span>
          <span className="horse-course__finish">GOAL</span>
          {HORSE_RACE_LANES.map((lane) => (
            <div
              className={`horse-course__lane horse-course__lane--${lane.id}`}
              aria-hidden="true"
              key={`lane-${lane.id}`}
            />
          ))}
          {HORSE_RACE_LANES.map((lane) => (
            <span
              className={`horse-course__lane-label horse-course__lane-label--${lane.id}`}
              key={`label-${lane.id}`}
            >
              {lane.label}
            </span>
          ))}

          {HORSE_RACE_LANES.map((lane) => {
            const runnerStateClass = getRunnerStateClass(lane.id)
            const isGalloping = runnerStateClass === 'race-runner--warming'
              || runnerStateClass === 'race-runner--racing'

            return (
              <div
                className={`race-runner race-runner--${lane.id} ${runnerStateClass}`}
                data-runner={lane.id}
                data-finished={hasFinished[lane.id]}
                key={lane.id}
              >
                <div className="runner-mover">
                  <HorseSprite id={lane.id} label={lane.sideViewLabel} isGalloping={isGalloping} />
                </div>
              </div>
            )
          })}
        </div>
        <GoalFocusFrontView state={state} userUploadMbps={result?.uploadMbps ?? uploadMbps} />
      </div>

      <dl className="horse-metrics">
        <div>
          <dt>下り</dt>
          <dd
            aria-live={isLiveDownload ? 'off' : 'polite'}
            data-live={isLiveDownload}
            data-speed-metric="download"
          >
            {formattedDownload} Mbps
          </dd>
        </div>
        <div>
          <dt>上り</dt>
          <dd
            aria-live={isLiveUpload ? 'off' : 'polite'}
            data-live={isLiveUpload}
            data-speed-metric="upload"
          >
            {formattedUpload} Mbps
          </dd>
        </div>
      </dl>
      {state === 'finished' && (
        <a className="race-results-cta" href="#measurement-results">
          <span>詳しい測定結果を見る</span>
          <span className="race-results-cta__arrow" aria-hidden="true">↓</span>
        </a>
      )}
    </section>
  )
}
