import { describe, expect, it } from 'vitest'
import { createRaceDay, formatRaceDayLine, getRaceName, jstDayFromMs, parseRaceDayWeather, RACE_NAMES } from './raceDay'

const weather = { area: '東京', label: '雨', going: '重', reportDatetime: '2026-10-23T17:00:00+09:00' }

describe('raceDay', () => {
  it('レース名は日付で決まり、10日で一巡する', () => {
    expect(getRaceName('2026-10-23')).toBe(getRaceName('2026-10-23'))
    const names = Array.from({ length: 10 }, (_, index) =>
      getRaceName(new Date(Date.UTC(2026, 9, 23) + index * 86_400_000).toISOString().slice(0, 10)))
    expect(new Set(names)).toEqual(new Set(RACE_NAMES))
    expect(getRaceName('2026-11-02')).toBe(getRaceName('2026-10-23'))
  })

  it('JSTの日付を使う', () => {
    expect(jstDayFromMs(Date.UTC(2026, 9, 23, 15, 0))).toBe('2026-10-24')
  })

  it('同じ日の正しい応答だけを天気として受け付ける', () => {
    expect(parseRaceDayWeather({ ok: true, day: '2026-10-23', weather }, '2026-10-23')).toEqual(weather)
    expect(parseRaceDayWeather({ ok: true, day: '2026-10-22', weather }, '2026-10-23')).toBeNull()
    expect(parseRaceDayWeather({ ok: true, day: '2026-10-23', weather: null }, '2026-10-23')).toBeNull()
    expect(parseRaceDayWeather({ ok: true, day: '2026-10-23', weather: { ...weather, going: '最悪' } }, '2026-10-23')).toBeNull()
    expect(parseRaceDayWeather({ ok: true, day: '2026-10-23', weather: { ...weather, area: '大阪' } }, '2026-10-23')).toBeNull()
  })

  it('投稿用の1行を作る', () => {
    const name = getRaceName('2026-10-23')
    expect(formatRaceDayLine(createRaceDay('2026-10-23', weather as never))).toBe(`${name}（東京 雨・馬場 重）`)
    expect(formatRaceDayLine(createRaceDay('2026-10-23'))).toBe(name)
  })
})
