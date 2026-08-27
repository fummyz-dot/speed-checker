import type { HorseId } from './horseRaceLanes'

export type HorseRaceTimelineState =
  | 'running'
  | 'waitingForAllFinish'
  | 'transitionToFrontView'
  | 'groupJumpFrontView'
  | 'finished'

export type HorseTimelineValues = Record<HorseId, number>
export type HorseTimelineFinishState = Record<HorseId, boolean>

export interface RaceTimelineSnapshotInput {
  nowMs: number
  raceStartedAtMs: number
  startProgress: number
  horseDurationsMs: HorseTimelineValues
  resultAvailableAtMs: number | null
  frontViewTransitionDurationMs: number
  groupJumpDurationMs: number
}

export interface RaceTimelineSnapshot {
  state: HorseRaceTimelineState
  progress: HorseTimelineValues
  finished: HorseTimelineFinishState
  remainingDurationsMs: HorseTimelineValues
  transitionProgress: number
  groupJumpProgress: number
  nextUpdateAtMs: number | null
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

const createHorseValues = <T>(createValue: (horse: HorseId) => T): Record<HorseId, T> => ({
  standard: createValue('standard'),
  fast: createValue('fast'),
  user: createValue('user'),
})

export const deriveRaceTimelineSnapshot = ({
  nowMs,
  raceStartedAtMs,
  startProgress,
  horseDurationsMs,
  resultAvailableAtMs,
  frontViewTransitionDurationMs,
  groupJumpDurationMs,
}: RaceTimelineSnapshotInput): RaceTimelineSnapshot => {
  const elapsedMs = Math.max(0, nowMs - raceStartedAtMs)
  const progress = createHorseValues((horse) => {
    const durationMs = Math.max(0, horseDurationsMs[horse])
    if (durationMs === 0) return 1
    return clamp(startProgress + ((elapsedMs / durationMs) * (1 - startProgress)), startProgress, 1)
  })
  const finished = createHorseValues((horse) => progress[horse] >= 1)
  const remainingDurationsMs = createHorseValues((horse) =>
    Math.max(0, horseDurationsMs[horse] - elapsedMs))
  const finishAtMs = createHorseValues((horse) => raceStartedAtMs + horseDurationsMs[horse])
  const unfinishedFinishTimes = (Object.keys(finished) as HorseId[])
    .filter((horse) => !finished[horse])
    .map((horse) => finishAtMs[horse])

  if (unfinishedFinishTimes.length > 0) {
    const hasFinishedHorse = (Object.keys(finished) as HorseId[])
      .some((horse) => finished[horse])
    return {
      state: hasFinishedHorse ? 'waitingForAllFinish' : 'running',
      progress,
      finished,
      remainingDurationsMs,
      transitionProgress: 0,
      groupJumpProgress: 0,
      nextUpdateAtMs: Math.min(...unfinishedFinishTimes),
    }
  }

  if (resultAvailableAtMs === null) {
    return {
      state: 'waitingForAllFinish',
      progress,
      finished,
      remainingDurationsMs,
      transitionProgress: 0,
      groupJumpProgress: 0,
      nextUpdateAtMs: null,
    }
  }

  const allFinishedAtMs = Math.max(...(Object.keys(finishAtMs) as HorseId[])
    .map((horse) => finishAtMs[horse]))
  const transitionStartedAtMs = Math.max(allFinishedAtMs, resultAvailableAtMs)
  const groupJumpStartedAtMs = transitionStartedAtMs + frontViewTransitionDurationMs
  const finishedAtMs = groupJumpStartedAtMs + groupJumpDurationMs
  const transitionProgress = clamp(
    (nowMs - transitionStartedAtMs) / frontViewTransitionDurationMs,
    0,
    1,
  )
  const groupJumpProgress = clamp(
    (nowMs - groupJumpStartedAtMs) / groupJumpDurationMs,
    0,
    1,
  )

  if (nowMs < groupJumpStartedAtMs) {
    return {
      state: 'transitionToFrontView',
      progress,
      finished,
      remainingDurationsMs,
      transitionProgress,
      groupJumpProgress: 0,
      nextUpdateAtMs: groupJumpStartedAtMs,
    }
  }

  if (nowMs < finishedAtMs) {
    return {
      state: 'groupJumpFrontView',
      progress,
      finished,
      remainingDurationsMs,
      transitionProgress: 1,
      groupJumpProgress,
      nextUpdateAtMs: finishedAtMs,
    }
  }

  return {
    state: 'finished',
    progress,
    finished,
    remainingDurationsMs,
    transitionProgress: 1,
    groupJumpProgress: 1,
    nextUpdateAtMs: null,
  }
}
