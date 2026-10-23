import { describe, expect, it, vi } from 'vitest'
import { handleRequest } from './index'
import {
  fetchRaceDay,
  goingFromForecast,
  JMA_TOKYO_FORECAST_URL,
  jstDayFromMs,
  parseTokyoForecast,
} from './raceDay'

// Shape of https://www.jma.go.jp/bosai/forecast/data/forecast/130000.json (first report only).
const forecast = (codes: string[], weathers: string[], times = ['2026-10-23T17:00:00+09:00', '2026-10-24T00:00:00+09:00', '2026-10-25T00:00:00+09:00']) => [{
  publishingOffice: '気象庁',
  reportDatetime: '2026-10-23T17:00:00+09:00',
  timeSeries: [{
    timeDefines: times,
    areas: [
      { area: { name: '伊豆諸島北部', code: '130020' }, weatherCodes: ['300', '300', '300'], weathers: ['雨', '雨', '雨'] },
      { area: { name: '東京地方', code: '130010' }, weatherCodes: codes, weathers: weathers },
    ],
  }],
}]

describe('goingFromForecast', () => {
  it.each([
    ['100', '晴れ', '晴れ', '良'],
    ['200', 'くもり', 'くもり', '良'],
    ['201', 'くもり　時々　晴れ', 'くもり', '良'],
    ['202', 'くもり　一時　雨', 'くもり', '稍重'],
    ['203', 'くもり　時々　雨', 'くもり', '稍重'],
    ['204', 'くもり　一時　雪', 'くもり', '稍重'],
    ['102', '晴れ　一時　雨', '晴れ', '稍重'],
    ['300', '雨', '雨', '重'],
    ['302', '雨　朝晩　くもり', '雨', '重'],
    ['308', '大雨', '雨', '不良'],
    ['300', '雨　所により　暴風雨', '雨', '不良'],
    ['400', '雪', '雪', '重'],
    ['406', '大雪', '雪', '不良'],
  ])('%s %s → %s・馬場%s', (code, text, label, going) => {
    expect(goingFromForecast(code, text)).toEqual({ label, going })
  })

  it('知らない天気コードは判定しない', () => {
    expect(goingFromForecast('500', '不明')).toBeNull()
    expect(goingFromForecast('20', 'くもり')).toBeNull()
  })
})

describe('parseTokyoForecast', () => {
  it('東京地方の、その日付の予報を選ぶ', () => {
    const data = forecast(['200', '302', '202'], ['くもり', '雨　朝晩　くもり', 'くもり　一時　雨'])
    expect(parseTokyoForecast(data, '2026-10-24')).toEqual({
      area: '東京', label: '雨', going: '重', reportDatetime: '2026-10-23T17:00:00+09:00',
    })
    expect(parseTokyoForecast(data, '2026-10-23')).toMatchObject({ label: 'くもり', going: '良' })
  })

  it('日付が変わった直後で今日の予報がまだなければnullにする', () => {
    const data = forecast(['200', '302', '202'], ['くもり', '雨', 'くもり'])
    expect(parseTokyoForecast(data, '2026-10-26')).toBeNull()
  })

  it('形式が変わったデータは推測せずnullにする', () => {
    expect(parseTokyoForecast({}, '2026-10-23')).toBeNull()
    expect(parseTokyoForecast([{ reportDatetime: 'x', timeSeries: [] }], '2026-10-23')).toBeNull()
    expect(parseTokyoForecast(forecast([200 as unknown as string], ['くもり']), '2026-10-23')).toBeNull()
  })
})

describe('fetchRaceDay', () => {
  const now = Date.UTC(2026, 9, 23, 12, 0) // 21:00 JST

  it('気象庁の予報を取得して今日の馬場を返す', async () => {
    const fetchMock = vi.fn(async () => Response.json(forecast(['202', '300', '100'], ['くもり　一時　雨', '雨', '晴れ'])))
    await expect(fetchRaceDay(now, fetchMock as unknown as typeof fetch)).resolves.toEqual({
      ok: true,
      day: '2026-10-23',
      weather: { area: '東京', label: 'くもり', going: '稍重', reportDatetime: '2026-10-23T17:00:00+09:00' },
    })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { cf?: unknown }]
    expect(url).toBe(JMA_TOKYO_FORECAST_URL)
    expect(init.cf).toEqual({ cacheTtl: 1800, cacheEverything: true })
  })

  it('取得に失敗したら天気なしで返す', async () => {
    const failing = vi.fn(async () => { throw new Error('network') })
    await expect(fetchRaceDay(now, failing as unknown as typeof fetch)).resolves.toEqual({ ok: true, day: '2026-10-23', weather: null })
    const notOk = vi.fn(async () => new Response('gone', { status: 404 }))
    await expect(fetchRaceDay(now, notOk as unknown as typeof fetch)).resolves.toEqual({ ok: true, day: '2026-10-23', weather: null })
  })

  it('JSTの日付で判定する', () => {
    expect(jstDayFromMs(Date.UTC(2026, 9, 23, 14, 59))).toBe('2026-10-23')
    expect(jstDayFromMs(Date.UTC(2026, 9, 23, 15, 0))).toBe('2026-10-24')
  })
})

describe('/api/race-day', () => {
  it('GETだけ受け付け、短時間キャッシュできる応答を返す', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(forecast(['100', '100', '100'], ['晴れ', '晴れ', '晴れ'], [
      `${jstDayFromMs(Date.now())}T17:00:00+09:00`, '2099-01-01T00:00:00+09:00', '2099-01-02T00:00:00+09:00',
    ]))))
    const env = { ASSETS: { fetch: vi.fn() } } as unknown as Env
    const response = await handleRequest(new Request('https://netspeedrace.com/api/race-day'), env)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=600')
    await expect(response.json()).resolves.toMatchObject({ ok: true, weather: { label: '晴れ', going: '良' } })

    const post = await handleRequest(new Request('https://netspeedrace.com/api/race-day', { method: 'POST' }), env)
    expect(post.status).toBe(405)
    vi.unstubAllGlobals()
  })
})
