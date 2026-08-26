import { describe, expect, it } from 'vitest'
import type { SpeedMeasurementResult } from '../types/measurement'
import { PUBLIC_SITE_URL } from './publicSite'
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
  it('投稿文にブランド、Download、Upload、Ping、ハッシュタグとcanonical URLを含める', () => {
    const text = createSharePostText(result(), 'http://localhost:5173/result?source=share#result')

    expect(text).toContain('Net Speed Raceで回線を測定しました')
    expect(text).toContain('↓ 528 Mbps')
    expect(text).toContain('↑ 49.6 Mbps')
    expect(text).toContain('Ping 59 ms')
    expect(text).toContain('#NetSpeedRace')
    expect(text).toContain(PUBLIC_SITE_URL)
    expect(text).not.toContain('source=share')
    expect(text).not.toContain('localhost')
    expect(text).not.toContain('workers.dev')
  })

  it('Pingが欠損している場合はPing行を省略する', () => {
    const text = createSharePostText(result({ pingMs: null }), 'https://example.com/')

    expect(text).not.toContain('Ping')
  })

  it('測定条件ラベルを投稿文へ含めない', () => {
    const text = createSharePostText(result({ conditionLabel: 'リビング 5GHz' }), 'https://example.com/')

    expect(text).not.toContain('リビング 5GHz')
  })

  it('X投稿用URLに投稿文をURL encodeする', () => {
    const postText = createSharePostText(result(), 'https://example.com/')
    const intentUrl = new URL(createXIntentUrl(postText))

    expect(intentUrl.origin).toBe('https://x.com')
    expect(intentUrl.pathname).toBe('/intent/post')
    expect(intentUrl.searchParams.get('text')).toBe(postText)
  })

  it('URLとして解釈できない値でもcanonical URLを使う', () => {
    expect(getSharePageUrl('not a url')).toBe(PUBLIC_SITE_URL)
  })
})
