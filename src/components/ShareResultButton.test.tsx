import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpeedMeasurementResult } from '../types/measurement'
import { ShareResultButton } from './ShareResultButton'

const shareImageMocks = vi.hoisted(() => ({
  createShareImageBlob: vi.fn(),
  createShareFilename: vi.fn(),
  downloadBlob: vi.fn(),
}))

vi.mock('../lib/shareImage', () => shareImageMocks)

const result: SpeedMeasurementResult = {
  id: 'measurement-1',
  measuredAt: '2026-08-20T12:00:00.000Z',
  downloadMbps: 528,
  uploadMbps: 49.6,
  pingMs: 59,
}

const blob = new Blob(['png'], { type: 'image/png' })
let clipboardDescriptor: PropertyDescriptor | undefined
let shareDescriptor: PropertyDescriptor | undefined
let canShareDescriptor: PropertyDescriptor | undefined

const setClipboard = (clipboard: unknown): void => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard })
}

const restoreNavigatorProperty = (property: 'clipboard' | 'share' | 'canShare', descriptor: PropertyDescriptor | undefined): void => {
  if (descriptor) Object.defineProperty(navigator, property, descriptor)
  else Reflect.deleteProperty(navigator, property)
}

class ClipboardItemMock {
  static supports = vi.fn(() => true)
  readonly data: Record<string, Blob>

  constructor(data: Record<string, Blob>) {
    this.data = data
  }
}

describe('ShareResultButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    shareDescriptor = Object.getOwnPropertyDescriptor(navigator, 'share')
    canShareDescriptor = Object.getOwnPropertyDescriptor(navigator, 'canShare')
    shareImageMocks.createShareImageBlob.mockResolvedValue(blob)
    shareImageMocks.createShareFilename.mockReturnValue('net-speed-race-20260820-1200.png')
  })

  afterEach(() => {
    restoreNavigatorProperty('clipboard', clipboardDescriptor)
    restoreNavigatorProperty('share', shareDescriptor)
    restoreNavigatorProperty('canShare', canShareDescriptor)
    vi.unstubAllGlobals()
  })

  it('4つの明示的な共有操作だけを表示する', () => {
    render(<ShareResultButton result={result} evaluations={[]} />)

    expect(screen.getByRole('button', { name: '画像をコピー' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'PNGを保存' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Xに投稿' })).toBeVisible()
    expect(screen.getByRole('button', { name: '投稿文をコピー' })).toBeVisible()
    expect(screen.queryByRole('button', { name: '結果を画像で共有' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Bluesky|Instagram/ })).not.toBeInTheDocument()
  })

  it('PNG画像をClipboardへコピーし、Web Share APIを使用しない', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    const share = vi.fn()
    const canShare = vi.fn()
    setClipboard({ write })
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare })
    vi.stubGlobal('ClipboardItem', ClipboardItemMock)

    render(<ShareResultButton result={result} evaluations={[]} />)
    fireEvent.click(screen.getByRole('button', { name: '画像をコピー' }))

    expect(await screen.findByRole('status')).toHaveTextContent('結果画像をコピーしました。')
    expect(shareImageMocks.createShareImageBlob).toHaveBeenCalledWith(result, [])
    expect(write).toHaveBeenCalledTimes(1)
    expect(ClipboardItemMock.supports).toHaveBeenCalledWith('image/png')
    const item = write.mock.calls[0][0][0] as ClipboardItemMock
    expect(item.data).toEqual({ 'image/png': blob })
    expect(share).not.toHaveBeenCalled()
    expect(canShare).not.toHaveBeenCalled()
  })

  it.each([
    ['Clipboard APIなし', undefined, ClipboardItemMock],
    ['ClipboardItemなし', { write: vi.fn() }, undefined],
  ])('%sでは画像コピーのfallbackを表示する', async (_, clipboard, clipboardItem) => {
    setClipboard(clipboard)
    vi.stubGlobal('ClipboardItem', clipboardItem)

    render(<ShareResultButton result={result} evaluations={[]} />)
    fireEvent.click(screen.getByRole('button', { name: '画像をコピー' }))

    expect(await screen.findByRole('status')).toHaveTextContent('このブラウザでは画像コピーを利用できません。PNG保存をご利用ください。')
    expect(shareImageMocks.createShareImageBlob).not.toHaveBeenCalled()
  })

  it('画像Clipboard書込みが失敗した場合もPNG保存案内を表示する', async () => {
    const write = vi.fn().mockRejectedValue(new Error('denied'))
    setClipboard({ write })
    vi.stubGlobal('ClipboardItem', ClipboardItemMock)

    render(<ShareResultButton result={result} evaluations={[]} />)
    fireEvent.click(screen.getByRole('button', { name: '画像をコピー' }))

    expect(await screen.findByRole('status')).toHaveTextContent('このブラウザでは画像コピーを利用できません。PNG保存をご利用ください。')
  })

  it('PNG保存で既存の画像生成・ファイル名・ダウンロード処理を使う', async () => {
    render(<ShareResultButton result={result} evaluations={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'PNGを保存' }))

    expect(await screen.findByRole('status')).toHaveTextContent('PNG画像を保存しました。')
    expect(shareImageMocks.createShareImageBlob).toHaveBeenCalledWith(result, [])
    expect(shareImageMocks.createShareFilename).toHaveBeenCalledWith(result.measuredAt)
    expect(shareImageMocks.downloadBlob).toHaveBeenCalledWith(blob, 'net-speed-race-20260820-1200.png')
  })

  it('投稿文をClipboardへコピーする', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    window.history.replaceState({}, '', '/result?from=test#share')

    render(<ShareResultButton result={result} evaluations={[]} />)
    fireEvent.click(screen.getByRole('button', { name: '投稿文をコピー' }))

    expect(await screen.findByRole('status')).toHaveTextContent('投稿文をコピーしました。')
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('https://netspeedrace.com/'))
    expect(shareImageMocks.createShareImageBlob).not.toHaveBeenCalled()
  })

  it('X投稿では画像を生成せず、安全な新しいタブで投稿画面を開く', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(window)

    render(<ShareResultButton result={result} evaluations={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Xに投稿' }))

    expect(open).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/x\.com\/intent\/post\?text=/),
      '_blank',
      'noopener,noreferrer',
    )
    expect(shareImageMocks.createShareImageBlob).not.toHaveBeenCalled()
  })
})
