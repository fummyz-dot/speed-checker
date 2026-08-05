import type { CSSProperties } from 'react'
import { useHorseRaceAnimation, type HorseRaceState } from '../hooks/useHorseRaceAnimation'
import { useLiveSpeedDisplay } from '../hooks/useLiveSpeedDisplay'
import { getUserHorseJumpHeight } from '../lib/horseVisualization'
import { HORSE_RACE_LANES, type HorseId } from '../lib/horseRaceLanes'
import { formatFinalSpeedDisplay, formatLiveSpeedDisplay } from '../lib/speedValue'
import type { SpeedMeasurementResult } from '../types/measurement'
import type { TestPhase } from '../types/speedTest'
import { GoalFocusFrontView } from './GoalFocusFrontView'

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
}

interface HorseIconProps {
  label: string
}

const HorseIcon = ({ label }: HorseIconProps) => (
  <svg viewBox="0 0 96 66" role="img" aria-label={label}>
    <path d="M17 39C8 34 4 25 3 17c8 7 14 9 23 10 8-13 22-18 38-13l9-8 3 11c10 3 16 10 17 20-7-3-13-4-19-2-8 3-13 10-24 10-13 0-24-2-33-6Z" />
    <path d="m29 43-13 18M47 45l-3 17M61 42l15 17M73 35l17 12" />
    <circle cx="82" cy="25" r="1.8" />
  </svg>
)

const getHelperText = (state: HorseRaceState, hasUploadResult: boolean): string => {
  switch (state) {
    case 'idle': return '測定開始を待っています'
    case 'measuringDownload': return 'ダウンロード測定中…'
    case 'running': return hasUploadResult ? 'レース進行中' : 'レース進行中・アップロード測定中…'
    case 'waitingForAllFinish': return '先着馬はゴールで待機中…'
    case 'transitionToFrontView': return 'ALL HORSES FINISHED'
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
  }
  const raceIsActive = state === 'running' || state === 'waitingForAllFinish'
  const frontViewIsActive = state === 'transitionToFrontView'
    || state === 'groupJumpFrontView'
    || state === 'finished'
  const getRunnerStateClass = (horse: HorseId): string => {
    if (frontViewIsActive) return 'race-runner--finished'
    if (hasFinished[horse]) return 'race-runner--waiting'
    return raceIsActive ? 'race-runner--racing' : 'race-runner--idle'
  }

  return (
    <section className="result-panel horse-visualization" aria-labelledby="horse-title">
      <div className="result-panel__heading">
        <div>
          <span className="result-panel__eyebrow">SPEED RACE</span>
          <h2 id="horse-title">回線速度レース</h2>
        </div>
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

          {HORSE_RACE_LANES.map((lane) => (
            <div
              className={`horse-runner race-runner race-runner--${lane.id} ${getRunnerStateClass(lane.id)}`}
              data-horse={lane.id}
              data-finished={hasFinished[lane.id]}
              key={lane.id}
            >
              <div className={`horse-jumper horse-jumper--${lane.id === 'user' ? 'user' : 'reference'}`}>
                <div className={`horse-body horse-body--${lane.id}`}>
                  <HorseIcon label={lane.sideViewLabel} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <GoalFocusFrontView state={state} />
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
    </section>
  )
}
