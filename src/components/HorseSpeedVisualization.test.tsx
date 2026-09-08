import { readFileSync } from 'node:fs'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getReferenceHorseDurations,
  getUserHorseJumpHeight,
  getUserHorseRunDuration,
  OGURI_REFERENCE_UPLOAD_MBPS,
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

const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState')

const setVisibilityState = (visibilityState: 'hidden' | 'visible') => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: visibilityState,
  })
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

  afterEach(() => {
    vi.useRealTimers()
    if (originalVisibilityState) {
      Object.defineProperty(document, 'visibilityState', originalVisibilityState)
    } else {
      Reflect.deleteProperty(document, 'visibilityState')
    }
  })

  const flushAnimationFrame = () => {
    const callbacks = animationFrames
    animationFrames = []
    act(() => callbacks.forEach((callback) => callback(0)))
  }

  const startRace = () => {
    flushAnimationFrame()
    flushAnimationFrame()
  }

  it('wall-clock再同期で未完走馬が後退しないよう横移動はlinear timingを維持する', () => {
    const styles = readFileSync(
      new URL('../styles.css', String(import.meta.url)),
      'utf8',
    )

    expect(styles).toContain(`.race-runner--racing .runner-mover {
  animation: runner-race-run var(--race-duration) linear forwards;
}`)
  })

  it('初期状態では3頭の競走馬をスタート地点で待機させる', () => {
    const { container } = render(
      <HorseSpeedVisualization downloadMbps={null} uploadMbps={null} phase="idle" result={null} />,
    )

    expect(container.querySelector('.horse-course__start')).toHaveTextContent('START')
    expect(container.querySelector('.horse-course__finish')).toHaveTextContent('GOAL')
    expect(screen.getAllByRole('img')).toHaveLength(3)
    expect(container.querySelector('.horse-course__lane-label--standard')).toHaveTextContent('地方馬')
    expect(container.querySelector('.horse-course__lane-label--fast')).toHaveTextContent('無敗の三冠馬')
    expect(container.querySelector('.horse-course__lane-label--user')).toHaveTextContent('あなた')
    expect(
      [...container.querySelectorAll('.horse-course__lane-label')].map((label) => label.textContent),
    ).toEqual(['地方馬', 'あなた', '無敗の三冠馬'])
    expect(
      [...container.querySelectorAll('[data-runner]')].map((runner) => runner.getAttribute('data-runner')),
    ).toEqual(['standard', 'user', 'fast'])
    expect(screen.getAllByRole('img').map((horse) => horse.getAttribute('aria-label'))).toEqual([
      '横向きに走る標準速度の競走馬',
      '横向きに走るあなたの回線速度の競走馬',
      '横向きに走る高速の競走馬',
    ])
    expect(container.querySelector('.horse-course')).toHaveAttribute('data-animation-state', 'idle')
    expect(container.querySelectorAll('.race-runner--idle')).toHaveLength(3)
    expect(container.querySelectorAll('.race-runner > .runner-mover > .horse-sprite')).toHaveLength(3)
    expect(container.querySelector('[data-horse-sprite="standard"]'))
      .toHaveAttribute('data-sprite-src', '/assets/horse/horse-standard-gallop.webp')
    expect(container.querySelector('[data-horse-sprite="standard"]'))
      .toHaveAttribute('data-idle-src', '/assets/horse/horse-standard-idle.webp')
    expect(container.querySelector('[data-horse-sprite="user"]'))
      .toHaveAttribute('data-sprite-src', '/assets/horse/horse-fast-gallop.webp')
    expect(container.querySelector('[data-horse-sprite="user"]'))
      .toHaveAttribute('data-idle-src', '/assets/horse/horse-fast-idle.webp')
    expect(container.querySelector('[data-horse-sprite="fast"]'))
      .toHaveAttribute('data-sprite-src', '/assets/horse/horse-user-gallop.webp')
    expect(container.querySelector('[data-horse-sprite="fast"]'))
      .toHaveAttribute('data-idle-src', '/assets/horse/horse-user-idle.webp')
    expect(container.querySelectorAll('.horse-sprite--static')).toHaveLength(3)
    expect(container.querySelector('.goal-focus-front-view')).toHaveAttribute('data-front-view-active', 'false')
    expect(screen.getByRole('button', { name: 'もう一度見る' })).toBeDisabled()
    expect(screen.queryByRole('link', { name: '詳しい測定結果を見る' })).not.toBeInTheDocument()
    expect(screen.queryByText('走行時間に反映')).not.toBeInTheDocument()
    expect(screen.queryByText('ジャンプ高に反映')).not.toBeInTheDocument()
    expect(screen.queryByText('ダウンロード後にレースが始まり、アップロード結果で最後のジャンプが決まります。'))
      .not.toBeInTheDocument()
  })

  it('preview時だけ動的な無敗の三冠馬の基準を補足表示とrace styleへ反映する', () => {
    const { container } = render(
      <HorseSpeedVisualization
        downloadMbps={null}
        uploadMbps={null}
        phase="idle"
        result={null}
        showChampionReference
        championReference={{
          source: 'previous_day_winner', sourceDay: '2026-08-27', scoreTenths: 16834,
          downloadMbps: 534.8, uploadMbps: 327.2, qualifyingRuns: 2847,
        }}
      />,
    )

    expect(screen.getByLabelText('無敗の三冠馬の比較基準')).toHaveTextContent('昨日の全国1位')
    expect(screen.getByLabelText('無敗の三冠馬の比較基準')).toHaveTextContent('535 Mbps')
    expect(screen.getByLabelText('無敗の三冠馬の比較基準')).toHaveTextContent('NET SPEED SCORE 1683.4')
    expect(container.querySelector('.horse-course')).toHaveStyle({
      '--fast-duration': `${getUserHorseRunDuration(534.8)}s`,
      '--fast-jump-height': `${getUserHorseJumpHeight(327.2).toFixed(0)}px`,
    })
  })

  it.each([
    ['latency', 'measuringDownload'],
    ['download', 'warmingUp'],
  ] as const)('%s中は詳細結果CTAを表示しない', (phase, expectedState) => {
    const { container } = render(
      <HorseSpeedVisualization downloadMbps={120} uploadMbps={null} phase={phase} result={null} />,
    )

    expect(container.querySelector('.horse-course')).toHaveAttribute('data-animation-state', expectedState)
    expect(screen.queryByRole('link', { name: '詳しい測定結果を見る' })).not.toBeInTheDocument()
  })

  it('集中時は同じレースcomponentをdialogとして表示し、縮小とEscapeを要求できる', () => {
    const onRequestExitFocus = vi.fn()
    const { container } = render(
      <HorseSpeedVisualization
        downloadMbps={null}
        uploadMbps={null}
        phase="idle"
        result={null}
        focused
        onRequestExitFocus={onRequestExitFocus}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: '回線速度レース' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(container.querySelector('.horse-visualization')).toHaveClass('horse-visualization--focused')
    expect(screen.getByRole('button', { name: '縮小' })).toHaveFocus()

    fireEvent.keyDown(dialog, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: '縮小' }))
    expect(onRequestExitFocus).toHaveBeenCalledTimes(2)
  })

  it('mobile集中時は縮小buttonをrenderせず、操作不能ならdialogへfocusする', () => {
    const { container } = render(
      <HorseSpeedVisualization
        downloadMbps={null}
        uploadMbps={null}
        phase="idle"
        result={null}
        focused
        showShrinkButton={false}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: '回線速度レース' })
    expect(container.querySelector('[data-race-focus-close]')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '縮小' })).not.toBeInTheDocument()
    expect(dialog).toHaveFocus()
  })

  it('desktop通常表示の測定中には、状態を保ったままレースを拡大できる', () => {
    const onRequestFocus = vi.fn()
    render(
      <HorseSpeedVisualization
        downloadMbps={120}
        uploadMbps={null}
        phase="download"
        result={null}
        onRequestFocus={onRequestFocus}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'レースを拡大' }))
    expect(onRequestFocus).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: '回線速度レース' })).not.toBeInTheDocument()
  })

  it('desktop通常完了時はレースを拡大できる', () => {
    const onRequestFocus = vi.fn()
    render(
      <HorseSpeedVisualization
        downloadMbps={120}
        uploadMbps={80}
        phase="complete"
        result={result}
        onRequestFocus={onRequestFocus}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'レースを拡大' }))
    expect(onRequestFocus).toHaveBeenCalledTimes(1)
  })

  it('レーンと順位を維持したまま、正面のuser/fast visual assetsを入れ替える', () => {
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
      [...container.querySelectorAll('[data-front-jockey]')].map((jockey) => jockey.getAttribute('data-front-jockey')),
    ).toEqual(['fast', 'user', 'standard'])
    expect(
      [...container.querySelectorAll('[data-front-horse]')].map((horse) => horse.getAttribute('data-front-horse')),
    ).toEqual(['fast', 'user', 'standard'])
    expect(container.querySelectorAll('.front-horse')).toHaveLength(3)
    expect(container.querySelectorAll('.front-jockey-jumper')).toHaveLength(3)
    expect(
      [...container.querySelectorAll('[data-front-jockey]')].map((jockey) => ({
        id: jockey.getAttribute('data-front-jockey'),
        expression: jockey.getAttribute('data-front-expression'),
        rank: jockey.getAttribute('data-upload-rank'),
      })),
    ).toEqual([
      { id: 'fast', expression: 'winner', rank: '1' },
      { id: 'user', expression: 'satisfied', rank: '2' },
      { id: 'standard', expression: 'disappointed', rank: '3' },
    ])
    expect(
      [...container.querySelectorAll('.front-horse')].map((horse) => horse.getAttribute('src')),
    ).toEqual([
      '/assets/horse/front/front-horse-user.webp',
      '/assets/horse/front/front-horse-fast.webp',
      '/assets/horse/front/front-horse-standard.webp',
    ])
    expect(
      [...container.querySelectorAll('.front-jockey-image')].map((jockey) => jockey.getAttribute('src')),
    ).toEqual([
      '/assets/horse/front/front-jockey-user-rank1.webp',
      '/assets/horse/front/front-jockey-fast-rank2.webp',
      '/assets/horse/front/front-jockey-standard-rank3.webp',
    ])
  })

  it('upload順位に応じて各レーンの騎手画像を切り替える', () => {
    const lowUploadResult = { ...result, uploadMbps: 1 }
    const { container } = render(
      <HorseSpeedVisualization downloadMbps={120} uploadMbps={1} phase="complete" result={lowUploadResult} />,
    )

    expect(
      [...container.querySelectorAll('.front-jockey-image')].map((jockey) => ({
        id: jockey.getAttribute('data-front-jockey'),
        rank: jockey.getAttribute('data-upload-rank'),
        src: jockey.getAttribute('src'),
      })),
    ).toEqual([
      { id: 'fast', rank: '1', src: '/assets/horse/front/front-jockey-user-rank1.webp' },
      { id: 'user', rank: '3', src: '/assets/horse/front/front-jockey-fast-rank3.webp' },
      { id: 'standard', rank: '2', src: '/assets/horse/front/front-jockey-standard-rank2.webp' },
    ])
  })

  it('Downloadのlive表示をUpload中も途切れさせず、final 510で本走する', () => {
    const finalResult = { ...result, downloadMbps: 510, uploadMbps: 51 }
    const { container, rerender } = render(
      <HorseSpeedVisualization downloadMbps={500} uploadMbps={null} phase="download" result={null} />,
    )
    const course = () => container.querySelector('.horse-course')
    const downloadMetric = container.querySelector('[data-speed-metric="download"]')

    expect(course()).toHaveAttribute('data-animation-state', 'warmingUp')
    expect(container.querySelectorAll('.race-runner--warming')).toHaveLength(3)
    expect(container.querySelectorAll('.race-runner--warming .horse-sprite--galloping')).toHaveLength(3)
    expect(downloadMetric).toHaveTextContent('500.000000 Mbps')
    expect(downloadMetric).toHaveAttribute('data-live', 'true')

    act(() => vi.advanceTimersByTime(WARMUP_DURATION_MS * 2))

    rerender(<HorseSpeedVisualization downloadMbps={500} uploadMbps={50} phase="upload" result={null} />)
    expect(downloadMetric).toHaveTextContent('500.000000 Mbps')
    expect(downloadMetric).not.toHaveTextContent('— Mbps')
    expect(downloadMetric).toHaveAttribute('data-live', 'true')
    flushAnimationFrame()
    expect(course()).toHaveAttribute('data-animation-state', 'warmingUp')
    expect(container.querySelectorAll('.race-runner--racing')).toHaveLength(0)
    expect(downloadMetric).toHaveTextContent(/500\.\d{6} Mbps/)
    expect(downloadMetric).not.toHaveTextContent('— Mbps')
    expect(downloadMetric).toHaveAttribute('data-live', 'true')
    expect(container.querySelector('[data-speed-metric="upload"]')).toHaveTextContent(/50\.\d{6} Mbps/)
    expect(container.querySelector('[data-speed-metric="upload"]')).toHaveAttribute('data-live', 'true')
    expect(course()).not.toHaveStyle({
      '--user-duration': `${(getUserHorseRunDuration(500) * (1 - WARMUP_MAX_PROGRESS)).toFixed(2)}s`,
    })

    rerender(<HorseSpeedVisualization downloadMbps={500} uploadMbps={50} phase="complete" result={finalResult} />)
    startRace()
    expect(course()).toHaveAttribute('data-animation-state', 'running')
    expect(screen.queryByRole('link', { name: '詳しい測定結果を見る' })).not.toBeInTheDocument()
    expect(container.querySelectorAll('.race-runner--racing')).toHaveLength(3)
    expect(container.querySelectorAll('.race-runner--racing .horse-sprite--galloping')).toHaveLength(3)
    expect((course() as HTMLElement).style.getPropertyValue('--race-start-progress'))
      .toBe(`${(WARMUP_MAX_PROGRESS * 100).toFixed(3)}%`)
    expect((course() as HTMLElement).style.getPropertyValue('--standard-duration'))
      .toBe(`${getReferenceHorseDurations().standard * (1 - WARMUP_MAX_PROGRESS)}s`)
    expect((course() as HTMLElement).style.getPropertyValue('--user-duration'))
      .toBe(`${(getUserHorseRunDuration(510) * (1 - WARMUP_MAX_PROGRESS)).toFixed(2)}s`)
    expect((course() as HTMLElement).style.getPropertyValue('--user-duration'))
      .not.toBe(`${(getUserHorseRunDuration(500) * (1 - WARMUP_MAX_PROGRESS)).toFixed(2)}s`)
    expect(downloadMetric).toHaveTextContent('510 Mbps')
    expect(downloadMetric).toHaveAttribute('data-live', 'false')
    expect(container.querySelector('[data-speed-metric="upload"]')).toHaveTextContent('51.0 Mbps')
    expect(container.querySelector('[data-speed-metric="upload"]')).toHaveAttribute('data-live', 'false')
  })

  it('先着馬を待機させ、最後の馬がゴールしてから正面表示へ切り替えて3人同時ジャンプを行う', () => {
    const { container, rerender } = render(
      <HorseSpeedVisualization downloadMbps={120} uploadMbps={null} phase="download" result={null} />,
    )
    const course = () => container.querySelector('.horse-course')

    rerender(<HorseSpeedVisualization downloadMbps={120} uploadMbps={null} phase="upload" result={null} />)
    expect(course()).toHaveAttribute('data-animation-state', 'warmingUp')
    rerender(<HorseSpeedVisualization downloadMbps={120} uploadMbps={80} phase="complete" result={result} />)
    startRace()
    expect(course()).toHaveAttribute('data-animation-state', 'running')
    expect((course() as HTMLElement).style.getPropertyValue('--user-jump-height'))
      .toBe(`${getUserHorseJumpHeight(80).toFixed(0)}px`)
    expect((course() as HTMLElement).style.getPropertyValue('--fast-jump-height'))
      .toBe(`${getUserHorseJumpHeight(OGURI_REFERENCE_UPLOAD_MBPS).toFixed(0)}px`)

    const lastHorseTime = getReferenceHorseDurations().standard * 1_000
    act(() => vi.advanceTimersByTime(lastHorseTime - 1))
    expect(course()).toHaveAttribute('data-animation-state', 'waitingForAllFinish')
    expect(screen.queryByRole('link', { name: '詳しい測定結果を見る' })).not.toBeInTheDocument()
    expect(container.querySelector('[data-runner="fast"]')).toHaveAttribute('data-finished', 'true')
    expect(container.querySelector('[data-runner="user"]')).toHaveAttribute('data-finished', 'true')
    expect(container.querySelector('[data-runner="standard"]')).toHaveAttribute('data-finished', 'false')
    expect(container.querySelector('[data-runner="fast"] .horse-sprite')).toHaveClass('horse-sprite--static')
    expect(container.querySelector('[data-runner="user"] .horse-sprite')).toHaveClass('horse-sprite--static')
    act(() => vi.advanceTimersByTime(1))
    expect(course()).toHaveAttribute('data-animation-state', 'transitionToFrontView')
    expect(screen.queryByRole('link', { name: '詳しい測定結果を見る' })).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-finished="true"]')).toHaveLength(3)
    expect(container.querySelector('.horse-course__track')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.goal-focus-front-view')).toHaveAttribute('data-front-view-active', 'true')
    expect(container.querySelector('[data-final-upload-result]')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: '正面で喜ぶ標準速度の騎手と競走馬' })).toBeVisible()
    expect(screen.getByRole('img', { name: '正面で喜ぶあなたの回線速度の騎手と競走馬' })).toBeVisible()
    expect(screen.getByRole('img', { name: '正面で喜ぶ高速の騎手と競走馬' })).toBeVisible()
    expect(container.querySelectorAll('.front-horse')).toHaveLength(3)
    expect(container.querySelectorAll('.front-jockey-jumper')).toHaveLength(3)

    act(() => vi.advanceTimersByTime(FRONT_VIEW_TRANSITION_DURATION_MS))
    expect(course()).toHaveAttribute('data-animation-state', 'groupJumpFrontView')
    expect(screen.queryByRole('link', { name: '詳しい測定結果を見る' })).not.toBeInTheDocument()
    expect(container.querySelector('[data-final-upload-result]')).toHaveTextContent('UPLOAD80.0Mbps')
    expect(container.querySelectorAll('.front-jockey-image')).toHaveLength(3)
    act(() => vi.advanceTimersByTime(GROUP_JUMP_DURATION_MS))
    expect(course()).toHaveAttribute('data-animation-state', 'finished')
    expect(container.querySelector('[data-final-upload-result]')).toHaveTextContent('UPLOAD80.0Mbps')
    expect(screen.getByRole('link', { name: '詳しい測定結果を見る' })).toHaveAttribute('href', '#measurement-results')
  })

  it('Uploadが長時間続いても本走せず、完了後にフォーカスして同時ジャンプする', () => {
    const fastResult = { ...result, downloadMbps: 1_000 }
    const { container, rerender } = render(
      <HorseSpeedVisualization downloadMbps={1_000} uploadMbps={null} phase="download" result={null} />,
    )
    const course = () => container.querySelector('.horse-course')

    rerender(<HorseSpeedVisualization downloadMbps={1_000} uploadMbps={null} phase="upload" result={null} />)
    act(() => vi.advanceTimersByTime(60_000))
    expect(course()).toHaveAttribute('data-animation-state', 'warmingUp')
    expect(container.querySelectorAll('.race-runner--racing')).toHaveLength(0)

    rerender(<HorseSpeedVisualization downloadMbps={1_000} uploadMbps={80} phase="complete" result={fastResult} />)
    startRace()
    expect(course()).toHaveAttribute('data-animation-state', 'running')
    act(() => vi.advanceTimersByTime(getReferenceHorseDurations().standard * (1 - WARMUP_MAX_PROGRESS) * 1_000))
    expect(course()).toHaveAttribute('data-animation-state', 'transitionToFrontView')
    act(() => vi.advanceTimersByTime(FRONT_VIEW_TRANSITION_DURATION_MS))
    expect(course()).toHaveAttribute('data-animation-state', 'groupJumpFrontView')
    act(() => vi.advanceTimersByTime(GROUP_JUMP_DURATION_MS))
    expect(course()).toHaveAttribute('data-animation-state', 'finished')
  })

  it('もう一度見るで3頭をidleへ戻してから測定済み値で再生する', () => {
    const finalResult = { ...result, downloadMbps: 510, uploadMbps: 51 }
    const { container } = render(
      <HorseSpeedVisualization downloadMbps={500} uploadMbps={50} phase="complete" result={finalResult} />,
    )
    const course = () => container.querySelector('.horse-course')

    startRace()
    act(() => vi.advanceTimersByTime(13_500))
    act(() => vi.advanceTimersByTime(FRONT_VIEW_TRANSITION_DURATION_MS))
    act(() => vi.advanceTimersByTime(GROUP_JUMP_DURATION_MS))
    expect(course()).toHaveAttribute('data-animation-state', 'finished')
    expect(container.querySelector('.goal-focus-front-view')).toHaveAttribute('data-front-view-active', 'true')
    expect(container.querySelector('[data-speed-metric="download"]')).toHaveTextContent('510 Mbps')
    expect(screen.getByRole('link', { name: '詳しい測定結果を見る' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'もう一度見る' }))
    expect(course()).toHaveAttribute('data-animation-state', 'idle')
    expect(screen.queryByRole('link', { name: '詳しい測定結果を見る' })).not.toBeInTheDocument()
    expect(container.querySelectorAll('.race-runner--idle')).toHaveLength(3)
    expect(container.querySelector('.horse-course__track')).toHaveAttribute('aria-hidden', 'false')
    expect(container.querySelector('.goal-focus-front-view')).toHaveAttribute('data-front-view-active', 'false')
    act(() => vi.advanceTimersByTime(FRONT_VIEW_TRANSITION_DURATION_MS - 1))
    expect(course()).toHaveAttribute('data-animation-state', 'idle')
    act(() => vi.advanceTimersByTime(1))
    startRace()
    expect(course()).toHaveAttribute('data-animation-state', 'running')
    expect(container.querySelectorAll('.race-runner--racing')).toHaveLength(3)
    expect((course() as HTMLElement).style.getPropertyValue('--user-duration'))
      .toBe(`${getUserHorseRunDuration(510).toFixed(2)}s`)
    expect((course() as HTMLElement).style.getPropertyValue('--user-duration'))
      .not.toBe(`${getUserHorseRunDuration(500).toFixed(2)}s`)
  })

  it('visible復帰時はtimer発火を待たずwall-clock時点の馬位置とfinished状態へ追いつく', () => {
    const { container } = render(
      <HorseSpeedVisualization downloadMbps={120} uploadMbps={80} phase="complete" result={result} />,
    )
    const course = () => container.querySelector('.horse-course') as HTMLElement
    const startedAtMs = Date.now()

    setVisibilityState('hidden')
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    vi.setSystemTime(startedAtMs + 13_000)
    setVisibilityState('visible')
    act(() => document.dispatchEvent(new Event('visibilitychange')))

    expect(course()).toHaveAttribute('data-animation-state', 'waitingForAllFinish')
    expect(container.querySelector('[data-runner="fast"]')).toHaveAttribute('data-finished', 'true')
    expect(container.querySelector('[data-runner="user"]')).toHaveAttribute('data-finished', 'true')
    expect(course().style.getPropertyValue('--fast-start-progress')).toBe('100.000%')

    vi.setSystemTime(startedAtMs + 60_000)
    act(() => document.dispatchEvent(new Event('visibilitychange')))

    expect(course()).toHaveAttribute('data-animation-state', 'finished')
    expect(screen.getByRole('link', { name: '詳しい測定結果を見る' })).toBeVisible()
  })

  it('mobile通常完了時は拡大buttonをrenderせず、UPLOAD専用rowとReplayでfocusへ戻る', () => {
    const onRequestFocus = vi.fn()
    const { container } = render(
      <HorseSpeedVisualization
        downloadMbps={120}
        uploadMbps={80}
        phase="complete"
        result={result}
        showExpandButton={false}
        onRequestFocus={onRequestFocus}
      />,
    )
    const course = () => container.querySelector('.horse-course')

    startRace()
    act(() => vi.advanceTimersByTime(13_500))
    act(() => vi.advanceTimersByTime(FRONT_VIEW_TRANSITION_DURATION_MS))
    act(() => vi.advanceTimersByTime(GROUP_JUMP_DURATION_MS))

    expect(course()).toHaveAttribute('data-animation-state', 'finished')
    expect(screen.queryByRole('button', { name: 'レースを拡大' })).not.toBeInTheDocument()
    expect(container.querySelector('.result-panel__heading')).toHaveClass('result-panel__heading--with-upload-result')
    expect(container.querySelector('[data-final-upload-result]')).toHaveTextContent('UPLOAD80.0Mbps')

    const replayButton = screen.getByRole('button', { name: 'もう一度見る' })
    expect(replayButton).toBeEnabled()
    fireEvent.click(replayButton)
    expect(onRequestFocus).toHaveBeenCalledTimes(1)
    expect(course()).toHaveAttribute('data-animation-state', 'idle')
  })

  it('集中画面ではreplay、詳細CTA、Tab循環を既存レースstateを保って扱う', () => {
    const onRequestFocus = vi.fn()
    const onShowDetails = vi.fn()
    const onRequestExitFocus = vi.fn()
    const { container } = render(
      <HorseSpeedVisualization
        downloadMbps={120}
        uploadMbps={80}
        phase="complete"
        result={result}
        focused
        showShrinkButton={false}
        onRequestFocus={onRequestFocus}
        onShowDetails={onShowDetails}
        onRequestExitFocus={onRequestExitFocus}
      />,
    )
    const course = () => container.querySelector('.horse-course')
    const dialog = screen.getByRole('dialog', { name: '回線速度レース' })

    startRace()
    act(() => vi.advanceTimersByTime(13_500))
    act(() => vi.advanceTimersByTime(FRONT_VIEW_TRANSITION_DURATION_MS))
    act(() => vi.advanceTimersByTime(GROUP_JUMP_DURATION_MS))
    expect(course()).toHaveAttribute('data-animation-state', 'finished')

    const detailsLink = screen.getByRole('link', { name: '詳しい測定結果を見る' })
    const replayButton = screen.getByRole('button', { name: 'もう一度見る' })
    expect(screen.queryByRole('button', { name: '縮小' })).not.toBeInTheDocument()
    detailsLink.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(replayButton).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(detailsLink).toHaveFocus()

    fireEvent.click(detailsLink)
    expect(onShowDetails).toHaveBeenCalledTimes(1)
    fireEvent.click(replayButton)
    expect(onRequestFocus).toHaveBeenCalledTimes(1)
    expect(course()).toHaveAttribute('data-animation-state', 'idle')
    expect(onRequestExitFocus).not.toHaveBeenCalled()
  })
})
