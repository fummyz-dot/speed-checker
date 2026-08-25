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
    expect(screen.getByRole('heading', { name: '負荷がかかっても安定しています' })).toBeVisible()
    expect(screen.getByText('+10 ms')).toBeVisible()
    expect(screen.getByText('+15 ms')).toBeVisible()
  })

  it('noticeではDownload側の影響を説明する', () => {
    render(<LoadedLatencyResponsiveness result={result({
      downloadLoadedLatencyMs: 40,
      uploadLoadedLatencyMs: 20,
    })} />)

    expect(screen.getByText('注意')).toBeVisible()
    expect(screen.getByText('大容量ダウンロード中に応答時間が増えています。他の通信で遅延を感じる可能性があります。')).toBeVisible()
  })

  it('poorでは要注意と大きな増加を表示する', () => {
    render(<LoadedLatencyResponsiveness result={result({
      uploadLoadedLatencyMs: 120.001,
    })} />)

    expect(screen.getByText('要注意')).toBeVisible()
    expect(screen.getByText('大きく増加')).toBeVisible()
    expect(screen.getByText('大容量アップロード中に応答時間が大きく増えています。Web会議やオンラインゲームなどのリアルタイム通信に影響する可能性があります。')).toBeVisible()
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

    expect(screen.getByRole('heading', { name: '混雑時の応答性を判定できませんでした' })).toBeVisible()
    expect(screen.getByText('比較に必要な応答時間を取得できなかったため、今回の測定では判定できませんでした。時間を置いて再測定してください。')).toBeVisible()
  })
})
