import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SpeedMeasurementResult } from '../types/measurement'
import { LoadedLatencyResponsiveness } from './LoadedLatencyResponsiveness'

const result = (overrides: Partial<SpeedMeasurementResult>): SpeedMeasurementResult => ({
  id: 'measurement-1',
  measuredAt: '2026-08-20T00:00:00.000Z',
  downloadMbps: 100,
  uploadMbps: 50,
  pingMs: 10,
  ...overrides,
})

describe('LoadedLatencyResponsiveness', () => {
  it('goodの応答性と方向別の増加量を表示する', () => {
    render(<LoadedLatencyResponsiveness result={result({
      downloadLoadedLatencyMs: 20,
      uploadLoadedLatencyMs: 25,
    })} />)

    expect(screen.getByText('良好')).toBeVisible()
    expect(screen.getByRole('heading', { name: '通信中も反応は安定しています' })).toBeVisible()
    expect(screen.getByText('+10 ms')).toBeVisible()
    expect(screen.getByText('+15 ms')).toBeVisible()
    expect(screen.getByRole('link', { name: '負荷時遅延の判定基準を見る' })).toHaveAttribute('href', '/loaded-latency/')
  })

  it('基本の遅延が長くても増加が小さければ増加量だけを良好とする', () => {
    render(<LoadedLatencyResponsiveness result={result({
      pingMs: 215,
      downloadLoadedLatencyMs: 220,
      uploadLoadedLatencyMs: 221,
    })} />)

    expect(screen.getByRole('heading', { name: '通信中の反応' })).toBeVisible()
    expect(screen.getByText('良好')).toBeVisible()
    expect(screen.getByText('通信中に、反応がどれだけ遅くなったかを見ています。')).toBeVisible()
    expect(screen.getByRole('rowheader', { name: '基本の遅延（Ping）' })).toBeVisible()
    expect(screen.getByText('215 ms')).toBeVisible()
    expect(screen.getByText('+5 ms')).toBeVisible()
    expect(screen.getByText('+6 ms')).toBeVisible()
  })

  it('noticeではDownload側の影響を説明する', () => {
    render(<LoadedLatencyResponsiveness result={result({
      downloadLoadedLatencyMs: 40,
      uploadLoadedLatencyMs: 20,
    })} />)

    expect(screen.getByText('注意')).toBeVisible()
    expect(screen.getByText('ダウンロード中に反応が遅くなっています。ほかの通信と重なると遅れを感じるかもしれません。')).toBeVisible()
  })

  it('poorでは要注意と大きな増加を表示する', () => {
    render(<LoadedLatencyResponsiveness result={result({
      uploadLoadedLatencyMs: 120.001,
    })} />)

    expect(screen.getByText('要注意')).toBeVisible()
    expect(screen.getByText('大きく増加')).toBeVisible()
    expect(screen.getByText('アップロード中に反応が大きく遅くなっています。Web会議やゲームに影響するかもしれません。')).toBeVisible()
  })

  it('Loaded latencyがIdle latencyより低い場合、実測値と増加なしを表示する', () => {
    render(<LoadedLatencyResponsiveness result={result({
      pingMs: 30,
      downloadLoadedLatencyMs: 20,
    })} />)

    expect(screen.getByText('20 ms')).toBeVisible()
    expect(screen.getByText('増加なし')).toBeVisible()
  })

  it('partialでは取得できた方向を表示し、欠損側を—とする', () => {
    render(<LoadedLatencyResponsiveness result={result({
      downloadLoadedLatencyMs: null,
      uploadLoadedLatencyMs: 35,
    })} />)

    expect(screen.getByText('+25 ms')).toBeVisible()
    expect(screen.getAllByText('—').length).toBeGreaterThan(1)
    expect(screen.getByText('一部の測定値を取得できなかったため、取得できた値のみで判定しています。')).toBeVisible()
  })

  it('Idle latencyが欠損している場合は判定不能を表示する', () => {
    render(<LoadedLatencyResponsiveness result={result({
      pingMs: null,
      downloadLoadedLatencyMs: 30,
      uploadLoadedLatencyMs: 40,
    })} />)

    expect(screen.getByRole('heading', { name: '判定できませんでした' })).toBeVisible()
    expect(screen.getByText('必要な値が取れませんでした。もう一度測定してください。')).toBeVisible()
  })
})
