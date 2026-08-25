import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpeedMeasurementResult } from '../types/measurement'
import { createShareImageBlob } from './shareImage'

const result = (overrides: Partial<SpeedMeasurementResult> = {}): SpeedMeasurementResult => ({
  id: 'measurement-1',
  measuredAt: '2026-08-20T12:00:00.000Z',
  downloadMbps: 528,
  uploadMbps: 49.6,
  pingMs: 10,
  downloadLoadedLatencyMs: 20,
  uploadLoadedLatencyMs: 120.001,
  ...overrides,
})

const pngBlob = new Blob(['png'], { type: 'image/png' })

const createCanvasContext = () => {
  const gradient = { addColorStop: vi.fn() }
  return {
    createLinearGradient: vi.fn(() => gradient),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 100 })),
    restore: vi.fn(),
    save: vi.fn(),
    strokeRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D
}

const installImageMock = (shouldFail: boolean) => {
  const sources: string[] = []
  class ImageMock {
    onerror: (() => void) | null = null
    onload: (() => void) | null = null

    set src(value: string) {
      sources.push(value)
      if (shouldFail) this.onerror?.()
      else this.onload?.()
    }
  }
  vi.stubGlobal('Image', ImageMock)
  return sources
}

describe('shareImage', () => {
  let context: CanvasRenderingContext2D

  beforeEach(() => {
    context = createCanvasContext()
    const canvas = document.createElement('canvas')
    Object.defineProperty(canvas, 'getContext', { value: vi.fn(() => context) })
    Object.defineProperty(canvas, 'toBlob', {
      value: (callback: BlobCallback) => callback(pngBlob),
    })
    const createElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) =>
      tagName === 'canvas' ? canvas : createElement(tagName)) as typeof document.createElement)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('旧Canvas馬のprimitiveを使わず、承認済みidle馬アセット3頭を描画する', async () => {
    const sources = installImageMock(false)

    await expect(createShareImageBlob(result(), [], 'https://example.com/speed')).resolves.toBe(pngBlob)

    expect(sources).toEqual([
      '/assets/horse/horse-standard-idle.webp',
      '/assets/horse/horse-user-idle.webp',
      '/assets/horse/horse-fast-idle.webp',
    ])
    expect(context.drawImage).toHaveBeenCalledTimes(3)
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 950, 48, 98, 83)
  })

  it('既存の応答性評価に基づくラベルを描画する', async () => {
    installImageMock(false)

    await createShareImageBlob(result(), [], 'https://example.com/speed')

    expect(context.fillText).toHaveBeenCalledWith('混雑時の応答性 要注意', 102, 486)
  })

  it('馬アセットの読込みが失敗してもPNGを生成する', async () => {
    installImageMock(true)

    await expect(createShareImageBlob(result(), [], 'https://example.com/speed')).resolves.toBe(pngBlob)

    expect(context.drawImage).not.toHaveBeenCalled()
  })

  it('呼出し側から渡されたサイトURLを描画し、固定workers.dev URLを使わない', async () => {
    installImageMock(false)

    await createShareImageBlob(result(), [], 'https://custom.example.jp/check')

    const drawnText = (context.fillText as ReturnType<typeof vi.fn>).mock.calls.map(([text]) => text)
    expect(drawnText).toContain('https://custom.example.jp/check')
    expect(drawnText.join('\n')).not.toContain('workers.dev')
  })
})
