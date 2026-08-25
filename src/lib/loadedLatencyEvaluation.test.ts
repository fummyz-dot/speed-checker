import { describe, expect, it } from 'vitest'
import { evaluateLoadedLatencyResponsiveness } from './loadedLatencyEvaluation'

const evaluate = (downloadIncreaseMs: number, uploadIncreaseMs?: number) =>
  evaluateLoadedLatencyResponsiveness({
    idleLatencyMs: 10,
    downloadLoadedLatencyMs: 10 + downloadIncreaseMs,
    uploadLoadedLatencyMs: uploadIncreaseMs === undefined ? undefined : 10 + uploadIncreaseMs,
  })

describe('evaluateLoadedLatencyResponsiveness', () => {
  it.each([
    [0, 'good'],
    [20, 'good'],
    [20.001, 'notice'],
    [100, 'notice'],
    [100.001, 'poor'],
  ] as const)('増加量 %s ms を %s と判定する', (increaseMs, level) => {
    const result = evaluate(increaseMs)

    expect(result.download).toMatchObject({ increaseMs, level })
  })

  it('Loaded latency が Idle latency より低い場合、増加量を0 msとして扱う', () => {
    const result = evaluateLoadedLatencyResponsiveness({
      idleLatencyMs: 30,
      downloadLoadedLatencyMs: 20,
    })

    expect(result.download).toEqual({ loadedLatencyMs: 20, increaseMs: 0, level: 'good' })
  })

  it('DownloadとUploadの悪い方を総合判定にする', () => {
    const result = evaluateLoadedLatencyResponsiveness({
      idleLatencyMs: 10,
      downloadLoadedLatencyMs: 30,
      uploadLoadedLatencyMs: 111,
    })

    expect(result.download.level).toBe('good')
    expect(result.upload.level).toBe('poor')
    expect(result.overall).toBe('poor')
  })

  it('DownloadがnoticeでUploadがgoodの場合、overallをnoticeにする', () => {
    const result = evaluateLoadedLatencyResponsiveness({
      idleLatencyMs: 10,
      downloadLoadedLatencyMs: 31,
      uploadLoadedLatencyMs: 30,
    })

    expect(result).toMatchObject({
      download: { level: 'notice' },
      upload: { level: 'good' },
      overall: 'notice',
      isPartial: false,
    })
  })

  it('Idle latency が欠損または異常値なら、Loaded latency があっても判定しない', () => {
    const missing = evaluateLoadedLatencyResponsiveness({
      downloadLoadedLatencyMs: 30,
      uploadLoadedLatencyMs: 40,
    })
    const invalid = evaluateLoadedLatencyResponsiveness({
      idleLatencyMs: Number.POSITIVE_INFINITY,
      downloadLoadedLatencyMs: 30,
      uploadLoadedLatencyMs: 40,
    })

    expect(missing).toMatchObject({
      download: { loadedLatencyMs: 30, increaseMs: null, level: 'unknown' },
      upload: { loadedLatencyMs: 40, increaseMs: null, level: 'unknown' },
      overall: 'unknown',
      isPartial: false,
    })
    expect(invalid.overall).toBe('unknown')
  })

  it('Downloadだけ欠損ならUploadだけで判定し、partialとする', () => {
    const result = evaluateLoadedLatencyResponsiveness({
      idleLatencyMs: 10,
      uploadLoadedLatencyMs: 31,
    })

    expect(result).toMatchObject({
      download: { level: 'unknown' },
      upload: { increaseMs: 21, level: 'notice' },
      overall: 'notice',
      isPartial: true,
    })
  })

  it('Uploadだけ欠損ならDownloadだけで判定し、partialとする', () => {
    const result = evaluateLoadedLatencyResponsiveness({
      idleLatencyMs: 10,
      downloadLoadedLatencyMs: 30,
    })

    expect(result).toMatchObject({
      download: { increaseMs: 20, level: 'good' },
      upload: { level: 'unknown' },
      overall: 'good',
      isPartial: true,
    })
  })

  it('DownloadとUploadの両方が欠損なら判定不能にする', () => {
    const result = evaluateLoadedLatencyResponsiveness({ idleLatencyMs: 10 })

    expect(result).toMatchObject({ overall: 'unknown', isPartial: false })
    expect(result.download.level).toBe('unknown')
    expect(result.upload.level).toBe('unknown')
  })

  it.each([
    [Number.NaN, 'downloadLoadedLatencyMs'],
    [Number.POSITIVE_INFINITY, 'downloadLoadedLatencyMs'],
    [-1, 'downloadLoadedLatencyMs'],
    ['20', 'downloadLoadedLatencyMs'],
    [Number.NEGATIVE_INFINITY, 'uploadLoadedLatencyMs'],
  ] as const)('%s を有効なLatencyとして扱わない', (value, field) => {
    const result = evaluateLoadedLatencyResponsiveness({
      idleLatencyMs: 0,
      [field]: value,
    })

    const direction = field === 'downloadLoadedLatencyMs' ? result.download : result.upload
    expect(direction).toEqual({ loadedLatencyMs: null, increaseMs: null, level: 'unknown' })
  })

  it('0 msを有効なLatencyとして扱う', () => {
    const result = evaluateLoadedLatencyResponsiveness({
      idleLatencyMs: 0,
      downloadLoadedLatencyMs: 0,
      uploadLoadedLatencyMs: 0,
    })

    expect(result).toMatchObject({
      download: { loadedLatencyMs: 0, increaseMs: 0, level: 'good' },
      upload: { loadedLatencyMs: 0, increaseMs: 0, level: 'good' },
      overall: 'good',
    })
  })
})
