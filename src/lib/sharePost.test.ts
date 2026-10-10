import { describe, expect, it } from 'vitest'
import type { SpeedMeasurementResult } from '../types/measurement'
import {
  createSharePostText,
  createXIntentUrl,
  getSharePageUrl,
  SHARE_PAGE_URL,
  type ShareRankingSummary,
} from './sharePost'

const result = (overrides: Partial<SpeedMeasurementResult> = {}): SpeedMeasurementResult => ({
  id: 'measurement-1',
  measuredAt: '2026-08-20T12:00:00.000Z',
  downloadMbps: 528,
  uploadMbps: 49.6,
  pingMs: 59,
  ...overrides,
})

describe('sharePost', () => {
  it('投稿文にブランド、Download、Upload、Ping、ハッシュタグとシェア用URLを含める', () => {
    const text = createSharePostText(result(), 'http://localhost:5173/result?source=share#result')

    expect(text).toContain('Net Speed Raceで回線を測定しました')
    expect(text).toContain('↓ 528 Mbps')
    expect(text).toContain('↑ 49.6 Mbps')
    expect(text).toContain('Ping 59 ms')
    expect(text).toContain('#NetSpeedRace')
    expect(text).toContain('https://netspeedrace.com/?s=x')
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

  it('URLとして解釈できない値でもシェア用URLを使う', () => {
    expect(getSharePageUrl('not a url')).toBe(SHARE_PAGE_URL)
    expect(SHARE_PAGE_URL).toBe('https://netspeedrace.com/?s=x')
  })

  it('参加を促す一言を含める', () => {
    expect(createSharePostText(result(), 'https://example.com/')).toContain('あなたの回線は何着？')
  })

  describe('ランキング参加時', () => {
    const ranking = (overrides: Partial<ShareRankingSummary> = {}): ShareRankingSummary => ({
      measurementId: 'measurement-1',
      rank: 5,
      tieCount: 1,
      totalRuns: 37,
      scoreTenths: 724,
      ...overrides,
    })

    it('本日の順位、出走数、スコアを1行で含める', () => {
      const text = createSharePostText(result(), 'https://example.com/', ranking())

      expect(text).toContain('本日の全国ランキング 5位 / 37頭（スコア 72.4）')
      expect(text).not.toContain('Net Speed Score')
    })

    it('出走数が10未満のときは出走数を含めない', () => {
      const text = createSharePostText(result(), 'https://example.com/', ranking({ rank: 2, totalRuns: 9, scoreTenths: 7899 }))

      expect(text).toContain('本日の全国ランキング 2位（スコア 789.9）')
      expect(text).not.toContain('頭')
    })

    it('出走数がちょうど10のときは出走数を含める', () => {
      const text = createSharePostText(result(), 'https://example.com/', ranking({ totalRuns: 10 }))

      expect(text).toContain('5位 / 10頭')
    })

    it('同率の場合は同率と表示する', () => {
      const text = createSharePostText(result(), 'https://example.com/', ranking({ tieCount: 2 }))

      expect(text).toContain('同率5位 / 37頭')
    })

    it('別の測定の順位は含めない', () => {
      const text = createSharePostText(result(), 'https://example.com/', ranking({ measurementId: 'other' }))

      expect(text).not.toContain('ランキング')
    })

    it('不正な順位は含めない', () => {
      expect(createSharePostText(result(), 'https://example.com/', ranking({ rank: 0 }))).not.toContain('ランキング')
      expect(createSharePostText(result(), 'https://example.com/', ranking({ rank: 40 }))).not.toContain('ランキング')
    })

    it('未参加の場合は順位行を省略する', () => {
      expect(createSharePostText(result(), 'https://example.com/')).not.toContain('ランキング')
    })
  })
})
