import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getReferenceHorseDurations,
  getUserHorseRunDuration,
} from '../lib/horseVisualization'
import {
  deriveRaceTimelineSnapshot,
  type HorseRaceTimelineState,
  type HorseTimelineFinishState,
  type HorseTimelineValues,
} from '../lib/raceTimeline'
import type { SpeedMeasurementResult } from '../types/measurement'
import { DEFAULT_RACE_CHAMPION_REFERENCE, type RaceChampionReference } from '../types/raceChampion'
import type { TestPhase } from '../types/speedTest'

export type HorseRaceState =
  | 'idle'
  | 'measuringDownload'
  | 'warmingUp'
  | HorseRaceTimelineState

export type HorseFinishState = HorseTimelineFinishState

interface UseHorseRaceAnimationOptions {
  phase: TestPhase
  downloadMbps: number | null
  result: SpeedMeasurementResult | null
  championReference?: RaceChampionReference
}

interface RaceTimeline {
  raceStartedAtMs: number
  startProgress: number
  horseDurationsMs: HorseTimelineValues
  resultAvailableAtMs: number | null
}

interface PendingRaceStart {
  raceStartedAtMs: number
  measuredDownload: number
  resultAvailableAtMs: number | null
}

const EMPTY_FINISH_STATE: HorseFinishState = {
  standard: false,
  fast: false,
  user: false,
}

const EMPTY_PROGRESS: HorseTimelineValues = {
  standard: 0,
  fast: 0,
  user: 0,
}

const EMPTY_REMAINING_DURATION: HorseTimelineValues = {
  standard: 0,
  fast: 0,
  user: 0,
}

export const FRONT_VIEW_TRANSITION_DURATION_MS = 520
export const GROUP_JUMP_DURATION_MS = 1_800
export const WARMUP_MAX_PROGRESS = 0.15
export const WARMUP_DURATION_MS = 12_000

const isDocumentHidden = (): boolean =>
  typeof document !== 'undefined' && document.visibilityState === 'hidden'

export const useHorseRaceAnimation = ({
  phase,
  downloadMbps,
  result,
  championReference = DEFAULT_RACE_CHAMPION_REFERENCE,
}: UseHorseRaceAnimationOptions) => {
  const [state, setState] = useState<HorseRaceState>('idle')
  const [hasFinished, setHasFinished] = useState<HorseFinishState>(EMPTY_FINISH_STATE)
  const [horseProgress, setHorseProgress] = useState<HorseTimelineValues>(EMPTY_PROGRESS)
  const [remainingDurationsMs, setRemainingDurationsMs] = useState<HorseTimelineValues>(
    EMPTY_REMAINING_DURATION,
  )
  const [referenceDurations, setReferenceDurations] = useState(() =>
    getReferenceHorseDurations(championReference.downloadMbps),
  )
  const [userRunDuration, setUserRunDuration] = useState(() => getUserHorseRunDuration(0))
  const [frontTransitionElapsedMs, setFrontTransitionElapsedMs] = useState(0)
  const [groupJumpElapsedMs, setGroupJumpElapsedMs] = useState(0)
  const [raceSequence, setRaceSequence] = useState(0)
  const previousPhaseRef = useRef<TestPhase>('idle')
  const warmupStartedAtRef = useRef<number | null>(null)
  const timelineRef = useRef<RaceTimeline | null>(null)
  const pendingRaceStartRef = useRef<PendingRaceStart | null>(null)
  const timelineTimerRef = useRef<number | null>(null)
  const synchronizeTimelineRef = useRef<() => void>(() => undefined)
  const resultRef = useRef(result)

  resultRef.current = result

  const cancelScheduledUpdate = useCallback(() => {
    if (timelineTimerRef.current !== null) {
      window.clearTimeout(timelineTimerRef.current)
      timelineTimerRef.current = null
    }
  }, [])

  const resetRace = useCallback((nextState: Extract<HorseRaceState, 'idle' | 'measuringDownload' | 'warmingUp'>) => {
    cancelScheduledUpdate()
    timelineRef.current = null
    pendingRaceStartRef.current = null
    setHasFinished(EMPTY_FINISH_STATE)
    setHorseProgress(EMPTY_PROGRESS)
    setRemainingDurationsMs(EMPTY_REMAINING_DURATION)
    setReferenceDurations(getReferenceHorseDurations(championReference.downloadMbps))
    setUserRunDuration(getUserHorseRunDuration(0))
    setFrontTransitionElapsedMs(0)
    setGroupJumpElapsedMs(0)
    setState(nextState)
    setRaceSequence((sequence) => sequence + 1)
  }, [cancelScheduledUpdate, championReference.downloadMbps])

  const synchronizeTimeline = useCallback(() => {
    cancelScheduledUpdate()
    if (isDocumentHidden()) return

    const nowMs = Date.now()
    const pendingRaceStart = pendingRaceStartRef.current
    if (pendingRaceStart) {
      if (nowMs < pendingRaceStart.raceStartedAtMs) {
        timelineTimerRef.current = window.setTimeout(
          () => synchronizeTimelineRef.current(),
          Math.max(0, Math.ceil(pendingRaceStart.raceStartedAtMs - nowMs)),
        )
        return
      }

      const reference = getReferenceHorseDurations(championReference.downloadMbps)
      timelineRef.current = {
        raceStartedAtMs: pendingRaceStart.raceStartedAtMs,
        startProgress: 0,
        horseDurationsMs: {
          standard: reference.standard * 1_000,
          fast: reference.fast * 1_000,
          user: getUserHorseRunDuration(pendingRaceStart.measuredDownload) * 1_000,
        },
        resultAvailableAtMs: pendingRaceStart.resultAvailableAtMs,
      }
      pendingRaceStartRef.current = null
    }

    const timeline = timelineRef.current
    if (!timeline) return

    const snapshot = deriveRaceTimelineSnapshot({
      nowMs,
      raceStartedAtMs: timeline.raceStartedAtMs,
      startProgress: timeline.startProgress,
      horseDurationsMs: timeline.horseDurationsMs,
      resultAvailableAtMs: timeline.resultAvailableAtMs,
      frontViewTransitionDurationMs: FRONT_VIEW_TRANSITION_DURATION_MS,
      groupJumpDurationMs: GROUP_JUMP_DURATION_MS,
    })

    setState(snapshot.state)
    setHasFinished(snapshot.finished)
    setHorseProgress(snapshot.progress)
    setRemainingDurationsMs(snapshot.remainingDurationsMs)
    setReferenceDurations({
      standard: snapshot.remainingDurationsMs.standard / 1_000,
      fast: snapshot.remainingDurationsMs.fast / 1_000,
    })
    setUserRunDuration(snapshot.remainingDurationsMs.user / 1_000)
    setFrontTransitionElapsedMs(snapshot.transitionProgress * FRONT_VIEW_TRANSITION_DURATION_MS)
    setGroupJumpElapsedMs(snapshot.groupJumpProgress * GROUP_JUMP_DURATION_MS)
    setRaceSequence((sequence) => sequence + 1)

    if (snapshot.nextUpdateAtMs !== null) {
      timelineTimerRef.current = window.setTimeout(
        () => synchronizeTimelineRef.current(),
        Math.max(0, Math.ceil(snapshot.nextUpdateAtMs - nowMs)),
      )
    }
  }, [cancelScheduledUpdate, championReference.downloadMbps])

  synchronizeTimelineRef.current = synchronizeTimeline

  const startRace = useCallback((
    measuredDownload: number,
    initialProgress = 0,
    waitForCameraReset = false,
  ) => {
    cancelScheduledUpdate()
    warmupStartedAtRef.current = null
    const raceStartedAtMs = Date.now() + (waitForCameraReset ? FRONT_VIEW_TRANSITION_DURATION_MS : 0)
    const resultAvailableAtMs = resultRef.current ? raceStartedAtMs : null

    if (waitForCameraReset) {
      timelineRef.current = null
      pendingRaceStartRef.current = {
        raceStartedAtMs,
        measuredDownload,
        resultAvailableAtMs,
      }
      setHasFinished(EMPTY_FINISH_STATE)
      setHorseProgress(EMPTY_PROGRESS)
      setRemainingDurationsMs(EMPTY_REMAINING_DURATION)
      setFrontTransitionElapsedMs(0)
      setGroupJumpElapsedMs(0)
      setState('idle')
      setRaceSequence((sequence) => sequence + 1)
      synchronizeTimeline()
      return
    }

    const remainingCourse = 1 - initialProgress
    const reference = getReferenceHorseDurations(championReference.downloadMbps)
    timelineRef.current = {
      raceStartedAtMs,
      startProgress: initialProgress,
      horseDurationsMs: {
        standard: reference.standard * remainingCourse * 1_000,
        fast: reference.fast * remainingCourse * 1_000,
        user: getUserHorseRunDuration(measuredDownload) * remainingCourse * 1_000,
      },
      resultAvailableAtMs,
    }
    pendingRaceStartRef.current = null
    synchronizeTimeline()
  }, [cancelScheduledUpdate, championReference.downloadMbps, synchronizeTimeline])

  useEffect(() => {
    const previousPhase = previousPhaseRef.current

    if (phase === 'idle') {
      warmupStartedAtRef.current = null
      resetRace('idle')
    } else if (phase === 'latency' && previousPhase !== 'latency') {
      warmupStartedAtRef.current = null
      resetRace('measuringDownload')
    } else if (phase === 'download' && previousPhase !== 'download') {
      resetRace('warmingUp')
      warmupStartedAtRef.current = Date.now()
    } else if (phase === 'upload' && previousPhase !== 'upload') {
      const warmupElapsed = warmupStartedAtRef.current === null
        ? 0
        : Date.now() - warmupStartedAtRef.current
      const warmupProgress = Math.min(
        WARMUP_MAX_PROGRESS,
        (warmupElapsed / WARMUP_DURATION_MS) * WARMUP_MAX_PROGRESS,
      )
      startRace(downloadMbps ?? 0, warmupProgress)
    } else if (phase === 'complete' && result) {
      if (!timelineRef.current && !pendingRaceStartRef.current) {
        startRace(result.downloadMbps)
      } else if (timelineRef.current && timelineRef.current.resultAvailableAtMs === null) {
        timelineRef.current.resultAvailableAtMs = Date.now()
        synchronizeTimeline()
      }
    } else if (phase === 'error') {
      warmupStartedAtRef.current = null
      resetRace('idle')
    }

    previousPhaseRef.current = phase
  }, [downloadMbps, phase, resetRace, result, startRace, synchronizeTimeline])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') synchronizeTimeline()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [synchronizeTimeline])

  useEffect(() => cancelScheduledUpdate, [cancelScheduledUpdate])

  const replay = () => {
    if (!result || phase !== 'complete') return
    startRace(result.downloadMbps, 0, true)
  }

  return {
    state,
    hasFinished,
    horseProgress,
    remainingDurationsMs,
    userRunDuration,
    referenceDurations,
    raceStartProgress: horseProgress.user,
    frontTransitionElapsedMs,
    groupJumpElapsedMs,
    raceSequence,
    canReplay: Boolean(result) && phase === 'complete' && state === 'finished',
    replay,
  }
}
