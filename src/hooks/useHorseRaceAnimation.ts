import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getReferenceHorseDurations,
  getUserHorseRunDuration,
} from '../lib/horseVisualization'
import type { HorseId } from '../lib/horseRaceLanes'
import type { SpeedMeasurementResult } from '../types/measurement'
import type { TestPhase } from '../types/speedTest'

export type HorseRaceState =
  | 'idle'
  | 'measuringDownload'
  | 'warmingUp'
  | 'running'
  | 'waitingForAllFinish'
  | 'transitionToFrontView'
  | 'groupJumpFrontView'
  | 'finished'

export type HorseFinishState = Record<HorseId, boolean>

interface UseHorseRaceAnimationOptions {
  phase: TestPhase
  downloadMbps: number | null
  result: SpeedMeasurementResult | null
}

const EMPTY_FINISH_STATE: HorseFinishState = {
  standard: false,
  fast: false,
  user: false,
}

export const FRONT_VIEW_TRANSITION_DURATION_MS = 520
export const GROUP_JUMP_DURATION_MS = 1_800
export const WARMUP_MAX_PROGRESS = 0.15
export const WARMUP_DURATION_MS = 12_000

const allHorsesFinished = (finishState: HorseFinishState): boolean =>
  finishState.standard && finishState.fast && finishState.user

export const useHorseRaceAnimation = ({
  phase,
  downloadMbps,
  result,
}: UseHorseRaceAnimationOptions) => {
  const [state, setState] = useState<HorseRaceState>('idle')
  const [hasFinished, setHasFinished] = useState<HorseFinishState>(EMPTY_FINISH_STATE)
  const [userRunDuration, setUserRunDuration] = useState(() => getUserHorseRunDuration(0))
  const [referenceDurations, setReferenceDurations] = useState(getReferenceHorseDurations)
  const [raceStartProgress, setRaceStartProgress] = useState(0)
  const [raceSequence, setRaceSequence] = useState(0)
  const [raceTimersActive, setRaceTimersActive] = useState(false)
  const animationFrameRef = useRef<number | null>(null)
  const cameraResetTimerRef = useRef<number | null>(null)
  const previousPhaseRef = useRef<TestPhase>('idle')
  const resultRef = useRef(result)
  const raceStartedRef = useRef(false)
  const finishStateRef = useRef<HorseFinishState>(EMPTY_FINISH_STATE)
  const warmupStartedAtRef = useRef<number | null>(null)

  resultRef.current = result

  const cancelScheduledStart = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (cameraResetTimerRef.current !== null) {
      window.clearTimeout(cameraResetTimerRef.current)
      cameraResetTimerRef.current = null
    }
  }, [])

  const startRace = useCallback((
    measuredDownload: number,
    initialProgress = 0,
    waitForCameraReset = false,
    resetVisual = true,
  ) => {
    cancelScheduledStart()
    raceStartedRef.current = true
    warmupStartedAtRef.current = null
    finishStateRef.current = EMPTY_FINISH_STATE
    setHasFinished(EMPTY_FINISH_STATE)
    setRaceTimersActive(false)
    const remainingCourse = 1 - initialProgress
    const baseReferenceDurations = getReferenceHorseDurations()
    setReferenceDurations({
      standard: baseReferenceDurations.standard * remainingCourse,
      fast: baseReferenceDurations.fast * remainingCourse,
    })
    setUserRunDuration(getUserHorseRunDuration(measuredDownload) * remainingCourse)
    setRaceStartProgress(initialProgress)
    if (resetVisual) setState('idle')

    const scheduleRunningFrame = () => {
      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = window.requestAnimationFrame(() => {
          animationFrameRef.current = null
          setState('running')
          setRaceSequence((sequence) => sequence + 1)
          setRaceTimersActive(true)
        })
      })
    }

    if (waitForCameraReset) {
      cameraResetTimerRef.current = window.setTimeout(() => {
        cameraResetTimerRef.current = null
        scheduleRunningFrame()
      }, FRONT_VIEW_TRANSITION_DURATION_MS)
    } else {
      scheduleRunningFrame()
    }
  }, [cancelScheduledStart])

  useEffect(() => {
    const previousPhase = previousPhaseRef.current

    if (phase === 'idle') {
      cancelScheduledStart()
      raceStartedRef.current = false
      warmupStartedAtRef.current = null
      finishStateRef.current = EMPTY_FINISH_STATE
      setHasFinished(EMPTY_FINISH_STATE)
      setRaceTimersActive(false)
      setRaceStartProgress(0)
      setState('idle')
    } else if (phase === 'latency' && previousPhase !== 'latency') {
      cancelScheduledStart()
      raceStartedRef.current = false
      warmupStartedAtRef.current = null
      finishStateRef.current = EMPTY_FINISH_STATE
      setHasFinished(EMPTY_FINISH_STATE)
      setRaceTimersActive(false)
      setRaceStartProgress(0)
      setState('measuringDownload')
    } else if (phase === 'download' && previousPhase !== 'download') {
      cancelScheduledStart()
      raceStartedRef.current = false
      warmupStartedAtRef.current = Date.now()
      finishStateRef.current = EMPTY_FINISH_STATE
      setHasFinished(EMPTY_FINISH_STATE)
      setRaceTimersActive(false)
      setRaceStartProgress(0)
      setState('warmingUp')
    } else if (phase === 'upload' && previousPhase !== 'upload') {
      const warmupElapsed = warmupStartedAtRef.current === null
        ? 0
        : Date.now() - warmupStartedAtRef.current
      const warmupProgress = Math.min(
        WARMUP_MAX_PROGRESS,
        (warmupElapsed / WARMUP_DURATION_MS) * WARMUP_MAX_PROGRESS,
      )
      startRace(downloadMbps ?? 0, warmupProgress, false, false)
    } else if (phase === 'complete' && result && !raceStartedRef.current) {
      startRace(result.downloadMbps)
    } else if (phase === 'error') {
      cancelScheduledStart()
      raceStartedRef.current = false
      warmupStartedAtRef.current = null
      finishStateRef.current = EMPTY_FINISH_STATE
      setHasFinished(EMPTY_FINISH_STATE)
      setRaceTimersActive(false)
      setRaceStartProgress(0)
      setState('idle')
    }

    previousPhaseRef.current = phase
  }, [cancelScheduledStart, downloadMbps, phase, result, startRace])

  useEffect(() => cancelScheduledStart, [cancelScheduledStart])

  useEffect(() => {
    if (raceSequence === 0 || !raceTimersActive) return

    const finishHorse = (horse: HorseId) => {
      const nextFinishState = { ...finishStateRef.current, [horse]: true }
      finishStateRef.current = nextFinishState
      setHasFinished(nextFinishState)

      if (allHorsesFinished(nextFinishState)) {
        setRaceTimersActive(false)
        setState(resultRef.current ? 'transitionToFrontView' : 'waitingForAllFinish')
      } else {
        setState('waitingForAllFinish')
      }
    }

    const timers = [
      window.setTimeout(() => finishHorse('standard'), referenceDurations.standard * 1_000),
      window.setTimeout(() => finishHorse('fast'), referenceDurations.fast * 1_000),
      window.setTimeout(() => finishHorse('user'), userRunDuration * 1_000),
    ]

    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [raceSequence, raceTimersActive, referenceDurations.fast, referenceDurations.standard, userRunDuration])

  useEffect(() => {
    if (state === 'waitingForAllFinish' && allHorsesFinished(hasFinished) && result) {
      setState('transitionToFrontView')
    }
  }, [hasFinished, result, state])

  useEffect(() => {
    if (state !== 'transitionToFrontView') return
    const focusTimer = window.setTimeout(
      () => setState('groupJumpFrontView'),
      FRONT_VIEW_TRANSITION_DURATION_MS,
    )
    return () => window.clearTimeout(focusTimer)
  }, [state])

  useEffect(() => {
    if (state !== 'groupJumpFrontView') return
    const jumpTimer = window.setTimeout(() => setState('finished'), GROUP_JUMP_DURATION_MS)
    return () => window.clearTimeout(jumpTimer)
  }, [state])

  const replay = () => {
    if (!result || phase !== 'complete') return
    startRace(result.downloadMbps, 0, true)
  }

  return {
    state,
    hasFinished,
    userRunDuration,
    referenceDurations,
    raceStartProgress,
    canReplay: Boolean(result) && phase === 'complete' && state === 'finished',
    replay,
  }
}
