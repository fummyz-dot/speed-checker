import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getReferenceHorseDurations,
  getUserHorseJumpHeight,
  getUserHorseRunDuration,
} from '../lib/horseVisualization'
import {
  FRONT_VIEW_TRANSITION_DURATION_MS,
  GROUP_JUMP_DURATION_MS,
  WARMUP_DURATION_MS,
  WARMUP_MAX_PROGRESS,
} from '../hooks/useHorseRaceAnimation'
import type { SpeedMeasurementResult } from '../types/measurement'
import { HorseSpeedVisualization } from './HorseSpeedVisualization'

const result: SpeedMeasurementResult = {
  id: 'measurement-1',
  measuredAt: '2026-08-04T00:00:00.000Z',
  downloadMbps: 120,
  uploadMbps: 80,
  pingMs: 12,
}

describe('HorseSpeedVisualization runner presentation', () => {
  let animationFrames: FrameRequestCallback[]

  beforeEach(() => {
    vi.useFakeTimers()
    animationFrames = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrames.push(callback)
      return animationFrames.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
  })

  afterEach(() => vi.useRealTimers())

  const flushAnimationFrame = () => {
    const callbacks = animationFrames
    animationFrames = []
    act(() => callbacks.forEach((callback) => callback(0)))
  }

  const startRace = () => {
    flushAnimationFrame()
    flushAnimationFrame()
  }

  it('初期状態では3人のランナーをスタート地点で待機させる', () => {
    const { container } = render(
      <HorseSpeedVisualization downloadMbps={null} uploadMbps={null} phase="idle" result={null} />,
    )

    expect(container.querySelector('.horse-course__start')).toHaveTextContent('START')
    expect(container.querySelector('.horse-course__finish')).toHaveTextContent('GOAL')
    expect(screen.getAllByRole('img')).toHaveLength(3)
    expect(container.querySelector('.horse-course__lane-label--standard')).toHaveTextContent('地区優勝')
    expect(container.querySelector('.horse-course__lane-label--fast')).toHaveTextContent('オリンピアン')
    expect(container.querySelector('.horse-course__lane-label--user')).toHaveTextContent('あなた')
    expect(
      [...container.querySelectorAll('.horse-course__lane-label')].map((label) => label.textContent),
    ).toEqual(['地区優勝', 'あなた', 'オリンピアン'])
    expect(
      [...container.querySelectorAll('[data-runner]')].map((runner) => runner.getAttribute('data-runner')),
    ).toEqual(['standard', 'user', 'fast'])
    expect(container.querySelector('.horse-course')).toHaveAttribute('data-animation-state', 'idle')
    expect(container.querySelectorAll('.race-runner--idle')).toHaveLength(3)
    expect(container.querySelectorAll('.race-runner > .runner-mover > .runner-side-view')).toHaveLength(3)
    expect(container.querySelectorAll('.runner-side-view__head')).toHaveLength(3)
    expect(container.querySelectorAll('.runner-side-view__torso')).toHaveLength(3)
    expect(container.querySelectorAll('.runner-side-view__left-arm')).toHaveLength(3)
    expect(container.querySelectorAll('.runner-side-view__right-arm')).toHaveLength(3)
    expect(container.querySelectorAll('.runner-side-view__left-leg')).toHaveLength(3)
    expect(container.querySelectorAll('.runner-side-view__right-leg')).toHaveLength(3)
    expect(container.querySelector('.goal-focus-front-view')).toHaveAttribute('data-front-view-active', 'false')
    expect(screen.getByRole('button', { name: 'もう一度見る' })).toBeDisabled()
    expect(screen.queryByText('走行時間に反映')).not.toBeInTheDocument()
    expect(screen.queryByText('ジャンプ高に反映')).not.toBeInTheDocument()
    expect(screen.queryByText('ダウンロード後にレースが始まり、アップロード結果で最後のジャンプが決まります。'))
      .not.toBeInTheDocument()
  })

  it('横レースのレーン順を維持し、正面ではオリンピアン・あなた・地区優勝の順にする', () => {
    const { container } = render(
      <HorseSpeedVisualization downloadMbps={120} uploadMbps={80} phase="complete" result={result} />,
    )

    expect(
      [...container.querySelectorAll('[data-runner]')].map((runner) => runner.getAttribute('data-runner')),
    ).toEqual(['standard', 'user', 'fast'])
    expect(
      [...container.querySelectorAll('[data-front-runner]')].map((runner) => runner.getAttribute('data-front-runner')),
    ).toEqual(['fast', 'user', 'standard'])
    expect(
      [...container.querySelectorAll('[data-runner-face]')].map((face) => face.getAttribute('data-runner-face')),
    ).toEqual(['fast', 'user', 'standard'])
    expect(container.querySelectorAll('.runner-face__shape')).toHaveLength(3)
    expect(container.querySelectorAll('.runner-face__hair')).toHaveLength(3)
    expect(container.querySelectorAll('.runner-face__brow')).toHaveLength(3)
    expect(container.querySelectorAll('.runner-face__mouth')).toHaveLength(3)
    expect(new Set(
      [...container.querySelectorAll('.runner-face__hair')].map((hair) => hair.getAttribute('d')),
    )).toHaveProperty('size', 3)
    expect(new Set(
      [...container.querySelectorAll('.runner-face__mouth')].map((mouth) => mouth.getAttribute('d')),
    )).toHaveProperty('size', 3)
  })

  it('download開始時に3頭が同じ速度でウォームアップし、最大15%の位置から本走へ移る', () => {
    const { container, rerender } = render(
      <HorseSpeedVisualization downloadMbps={null} uploadMbps={null} phase="idle" result={null} />,
    )
    const course = () => container.querySelector('.horse-course')

    rerender(<HorseSpeedVisualization downloadMbps={40} uploadMbps={null} phase="download" result={null} />)
    expect(course()).toHaveAttribute('data-animation-state', 'warmingUp')
    expect(container.querySelectorAll('.race-runner--warming')).toHaveLength(3)
    expect(container.querySelectorAll('.race-runner--warming .runner-side-view')).toHaveLength(3)
    expect(container.querySelectorAll('.race-runner--warming .runner-side-view__limb')).toHaveLength(12)

    act(() => vi.advanceTimersByTime(WARMUP_DURATION_MS * 2))

    rerender(<HorseSpeedVisualization downloadMbps={120} uploadMbps={null} phase="upload" result={null} />)
    expect(course()).toHaveAttribute('data-animation-state', 'warmingUp')
    startRace()
    expect(course()).toHaveAttribute('data-animation-state', 'running')
    expect(container.querySelectorAll('.race-runner--racing')).toHaveLength(3)
    expect((course() as HTMLElement).style.getPropertyValue('--race-start-progress'))
      .toBe(`${(WARMUP_MAX_PROGRESS * 100).toFixed(3)}%`)
    expect((course() as HTMLElement).style.getPropertyValue('--standard-duration'))
      .toBe(`${getReferenceHorseDurations().standard * (1 - WARMUP_MAX_PROGRESS)}s`)
  })

  it('先着ランナーを待機させ、最後のランナーがゴールしてから正面表示へ切り替えて3人同時ジャンプを行う', () => {
    const { container, rerender } = render(
      <HorseSpeedVisualization downloadMbps={120} uploadMbps={null} phase="download" result={null} />,
    )
    const course = () => container.querySelector('.horse-course')

    rerender(<HorseSpeedVisualization downloadMbps={120} uploadMbps={null} phase="upload" result={null} />)
    startRace()
    rerender(<HorseSpeedVisualization downloadMbps={120} uploadMbps={80} phase="complete" result={result} />)
    expect(course()).toHaveAttribute('data-animation-state', 'running')
    expect((course() as HTMLElement).style.getPropertyValue('--user-jump-height'))
      .toBe(`${getUserHorseJumpHeight(80).toFixed(0)}px`)

    const lastHorseTime = getReferenceHorseDurations().standard * 1_000
    act(() => vi.advanceTimersByTime(lastHorseTime - 1))
    expect(course()).toHaveAttribute('data-animation-state', 'waitingForAllFinish')
    expect(container.querySelector('[data-runner="fast"]')).toHaveAttribute('data-finished', 'true')
    expect(container.querySelector('[data-runner="user"]')).toHaveAttribute('data-finished', 'true')
    expect(container.querySelector('[data-runner="standard"]')).toHaveAttribute('data-finished', 'false')
    act(() => vi.advanceTimersByTime(1))
    expect(course()).toHaveAttribute('data-animation-state', 'transitionToFrontView')
    expect(container.querySelectorAll('[data-finished="true"]')).toHaveLength(3)
    expect(container.querySelector('.horse-course__track')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.goal-focus-front-view')).toHaveAttribute('data-front-view-active', 'true')
    expect(container.querySelector('[data-final-upload-result]')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: '正面を向いた標準速度のランナー' })).toBeVisible()
    expect(screen.getByRole('img', { name: '正面を向いたあなたの回線速度のランナー' })).toBeVisible()
    expect(screen.getByRole('img', { name: '正面を向いた高速のランナー' })).toBeVisible()
    expect(container.querySelectorAll('.front-runner__jumper')).toHaveLength(3)

    act(() => vi.advanceTimersByTime(FRONT_VIEW_TRANSITION_DURATION_MS))
    expect(course()).toHaveAttribute('data-animation-state', 'groupJumpFrontView')
    expect(container.querySelector('[data-final-upload-result]')).toHaveTextContent('UPLOAD80.0Mbps')
    expect(container.querySelectorAll('.runner-front-view__arm')).toHaveLength(6)
    act(() => vi.advanceTimersByTime(GROUP_JUMP_DURATION_MS))
    expect(course()).toHaveAttribute('data-animation-state', 'finished')
    expect(container.querySelector('[data-final-upload-result]')).toHaveTextContent('UPLOAD80.0Mbps')
  })

  it('全頭完走時にupload未完了なら待機し、確定後にフォーカスして同時ジャンプする', () => {
    const fastResult = { ...result, downloadMbps: 1_000 }
    const { container, rerender } = render(
      <HorseSpeedVisualization downloadMbps={1_000} uploadMbps={null} phase="download" result={null} />,
    )
    const course = () => container.querySelector('.horse-course')

    rerender(<HorseSpeedVisualization downloadMbps={1_000} uploadMbps={null} phase="upload" result={null} />)
    startRace()
    act(() => vi.advanceTimersByTime(getUserHorseRunDuration(1_000) * 1_000))
    expect(course()).toHaveAttribute('data-animation-state', 'waitingForAllFinish')
    expect(container.querySelector('[data-runner="user"]')).toHaveClass('race-runner--waiting')

    const remainingTime = (getReferenceHorseDurations().standard - getUserHorseRunDuration(1_000)) * 1_000
    act(() => vi.advanceTimersByTime(remainingTime + 1))
    expect(course()).toHaveAttribute('data-animation-state', 'waitingForAllFinish')
    expect(container.querySelectorAll('[data-finished="true"]')).toHaveLength(3)

    rerender(<HorseSpeedVisualization downloadMbps={1_000} uploadMbps={80} phase="complete" result={fastResult} />)
    expect(course()).toHaveAttribute('data-animation-state', 'transitionToFrontView')
    act(() => vi.advanceTimersByTime(FRONT_VIEW_TRANSITION_DURATION_MS))
    expect(course()).toHaveAttribute('data-animation-state', 'groupJumpFrontView')
    act(() => vi.advanceTimersByTime(GROUP_JUMP_DURATION_MS))
    expect(course()).toHaveAttribute('data-animation-state', 'finished')
  })

  it('もう一度見るで3頭をidleへ戻してから測定済み値で再生する', () => {
    const { container } = render(
      <HorseSpeedVisualization downloadMbps={120} uploadMbps={80} phase="complete" result={result} />,
    )
    const course = () => container.querySelector('.horse-course')

    startRace()
    act(() => vi.advanceTimersByTime(13_500))
    act(() => vi.advanceTimersByTime(FRONT_VIEW_TRANSITION_DURATION_MS))
    act(() => vi.advanceTimersByTime(GROUP_JUMP_DURATION_MS))
    expect(course()).toHaveAttribute('data-animation-state', 'finished')
    expect(container.querySelector('.goal-focus-front-view')).toHaveAttribute('data-front-view-active', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'もう一度見る' }))
    expect(course()).toHaveAttribute('data-animation-state', 'idle')
    expect(container.querySelectorAll('.race-runner--idle')).toHaveLength(3)
    expect(container.querySelector('.horse-course__track')).toHaveAttribute('aria-hidden', 'false')
    expect(container.querySelector('.goal-focus-front-view')).toHaveAttribute('data-front-view-active', 'false')
    act(() => vi.advanceTimersByTime(FRONT_VIEW_TRANSITION_DURATION_MS - 1))
    expect(course()).toHaveAttribute('data-animation-state', 'idle')
    act(() => vi.advanceTimersByTime(1))
    startRace()
    expect(course()).toHaveAttribute('data-animation-state', 'running')
    expect(container.querySelectorAll('.race-runner--racing')).toHaveLength(3)
  })
})
