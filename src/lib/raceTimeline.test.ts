import { describe, expect, it } from 'vitest'
import { deriveRaceTimelineSnapshot } from './raceTimeline'

const raceStartedAtMs = 10_000
const horseDurationsMs = {
  standard: 13_500,
  fast: 10_000,
  user: 12_000,
}

const snapshotAt = (nowMs: number, resultAvailableAtMs: number | null = raceStartedAtMs) =>
  deriveRaceTimelineSnapshot({
    nowMs,
    raceStartedAtMs,
    startProgress: 0,
    horseDurationsMs,
    resultAvailableAtMs,
    frontViewTransitionDurationMs: 520,
    groupJumpDurationMs: 1_800,
  })

describe('deriveRaceTimelineSnapshot', () => {
  it('開始直後と走行途中の馬ごとの位置・残り時間をwall-clockから導出する', () => {
    expect(snapshotAt(raceStartedAtMs)).toMatchObject({
      state: 'running',
      progress: { standard: 0, fast: 0, user: 0 },
      finished: { standard: false, fast: false, user: false },
      remainingDurationsMs: horseDurationsMs,
      nextUpdateAtMs: raceStartedAtMs + horseDurationsMs.fast,
    })

    const inProgress = snapshotAt(raceStartedAtMs + 6_000)
    expect(inProgress.state).toBe('running')
    expect(inProgress.progress.standard).toBeCloseTo(6_000 / 13_500)
    expect(inProgress.progress.fast).toBeCloseTo(0.6)
    expect(inProgress.progress.user).toBeCloseTo(0.5)
    expect(inProgress.remainingDurationsMs.user).toBe(6_000)
  })

  it('先着馬はGOAL待機にし、全馬の完走後はfront transitionへ進める', () => {
    const withOneFinished = snapshotAt(raceStartedAtMs + horseDurationsMs.fast)
    expect(withOneFinished).toMatchObject({
      state: 'waitingForAllFinish',
      finished: { standard: false, fast: true, user: false },
      nextUpdateAtMs: raceStartedAtMs + horseDurationsMs.user,
    })

    const allFinished = snapshotAt(raceStartedAtMs + horseDurationsMs.standard)
    expect(allFinished).toMatchObject({
      state: 'transitionToFrontView',
      finished: { standard: true, fast: true, user: true },
      transitionProgress: 0,
      nextUpdateAtMs: raceStartedAtMs + horseDurationsMs.standard + 520,
    })
  })

  it('結果が未確定なら全馬完走後も待機し、確定時刻からfront transitionを始める', () => {
    const waiting = snapshotAt(raceStartedAtMs + horseDurationsMs.standard + 500, null)
    expect(waiting).toMatchObject({
      state: 'waitingForAllFinish',
      nextUpdateAtMs: null,
    })

    const transition = snapshotAt(raceStartedAtMs + horseDurationsMs.standard + 1_300, raceStartedAtMs + horseDurationsMs.standard + 1_000)
    expect(transition.state).toBe('transitionToFrontView')
    expect(transition.transitionProgress).toBeCloseTo(300 / 520)
  })

  it('front transition、group jump、finishedをタイマー発火ではなく経過時刻で切り替える', () => {
    const transitionEnd = raceStartedAtMs + horseDurationsMs.standard + 520
    const groupJump = snapshotAt(transitionEnd)
    expect(groupJump).toMatchObject({
      state: 'groupJumpFrontView',
      groupJumpProgress: 0,
      nextUpdateAtMs: transitionEnd + 1_800,
    })

    const jumpInProgress = snapshotAt(transitionEnd + 900)
    expect(jumpInProgress.state).toBe('groupJumpFrontView')
    expect(jumpInProgress.groupJumpProgress).toBeCloseTo(0.5)

    expect(snapshotAt(transitionEnd + 1_800)).toMatchObject({
      state: 'finished',
      groupJumpProgress: 1,
      nextUpdateAtMs: null,
    })
  })

  it('非表示中に経過した時間を復帰時に反映し、長時間後はfinishedに追いつく', () => {
    const afterHidden = snapshotAt(raceStartedAtMs + 13_000)
    expect(afterHidden).toMatchObject({
      state: 'waitingForAllFinish',
      finished: { standard: false, fast: true, user: true },
    })

    expect(snapshotAt(raceStartedAtMs + 60_000).state).toBe('finished')
  })

  it('replay用の新しい開始時刻では古い完走状態を引き継がない', () => {
    const replay = deriveRaceTimelineSnapshot({
      nowMs: 80_000,
      raceStartedAtMs: 80_000,
      startProgress: 0,
      horseDurationsMs,
      resultAvailableAtMs: 80_000,
      frontViewTransitionDurationMs: 520,
      groupJumpDurationMs: 1_800,
    })

    expect(replay).toMatchObject({
      state: 'running',
      finished: { standard: false, fast: false, user: false },
    })
  })
})
