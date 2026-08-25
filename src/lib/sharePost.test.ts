import { describe, expect, it } from 'vitest'
import type { SpeedMeasurementResult } from '../types/measurement'
import { createSharePostText, createXIntentUrl, getSharePageUrl } from './sharePost'

const result = (overrides: Partial<SpeedMeasurementResult> = {}): SpeedMeasurementResult => ({
  id: 'measurement-1',
  measuredAt: '2026-08-20T12:00:00.000Z',
  downloadMbps: 528,
  uploadMbps: 49.6,
  pingMs: 59,
  ...overrides,
})

describe('sharePost', () => {
  it('投稿文にDownload、Upload、Ping、ハッシュタグと現在ページURLを含める', () => {
    const text = createSharePostText(result(), 'https://example.com/speed?source=share#result')

    expect(text).toContain('↓ 528 Mbps')
    expect(text).toContain('↑ 49.6 Mbps')
    expect(text).toContain('Ping 59 ms')
    expect(text).toContain('#SpeedChecker')
    expect(text).toContain('https://example.com/speed')
    expect(text).not.toContain('source=share')
    expect(text).not.toContain('workers.dev')
  })

  it('Pingが欠損している場合はPing行を省略する', () => {
    const text = createSharePostText(result({ pingMs: null }), 'https://example.com/')

    expect(text).not.toContain('Ping')
  })

  it('X投稿用URLに投稿文をURL encodeする', () => {
    const postText = createSharePostText(result(), 'https://example.com/')
    const intentUrl = new URL(createXIntentUrl(postText))

    expect(intentUrl.origin).toBe('https://x.com')
    expect(intentUrl.pathname).toBe('/intent/post')
    expect(intentUrl.searchParams.get('text')).toBe(postText)
  })

  it('URLとして解釈できない値はそのまま投稿文に使う', () => {
    expect(getSharePageUrl('not a url')).toBe('not a url')
  })
})
