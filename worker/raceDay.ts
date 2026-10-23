/**
 * Today's Tokyo weather from the Japan Meteorological Agency forecast, turned into a racecourse
 * going (馬場状態). The JMA JSON is public but undocumented and may change without notice, so any
 * fetch or parse problem yields `weather: null` instead of a guessed value.
 */
export const JMA_TOKYO_FORECAST_URL = 'https://www.jma.go.jp/bosai/forecast/data/forecast/130000.json'
const TOKYO_AREA_CODE = '130010'
const JMA_FETCH_TIMEOUT_MS = 3000
const JMA_EDGE_CACHE_TTL_SEC = 1800
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

export type Going = '良' | '稍重' | '重' | '不良'
export type WeatherLabel = '晴れ' | 'くもり' | '雨' | '雪'

export interface RaceDayWeather {
  area: '東京'
  label: WeatherLabel
  going: Going
  reportDatetime: string
}

export interface RaceDayResponse {
  ok: true
  day: string
  weather: RaceDayWeather | null
}

export const jstDayFromMs = (nowMs: number): string =>
  new Date(nowMs + JST_OFFSET_MS).toISOString().slice(0, 10)

const WEATHER_LABELS: Record<string, WeatherLabel> = { 1: '晴れ', 2: 'くもり', 3: '雨', 4: '雪' }

/**
 * 晴れ・くもり → 良、ただし一時／時々の雨・雪を含めば 稍重。
 * 雨・雪 → 重、大雨・暴風雨・大雪・暴風雪なら 不良。
 */
export const goingFromForecast = (weatherCode: string, weatherText: string): { label: WeatherLabel, going: Going } | null => {
  if (!/^[1-4]\d{2}$/u.test(weatherCode)) return null
  const label = WEATHER_LABELS[weatherCode[0]]
  const text = weatherText.replace(/\s+/gu, '')
  if (label === '雨' || label === '雪') {
    return { label, going: /大雨|暴風雨|大雪|暴風雪/u.test(text) ? '不良' : '重' }
  }
  return { label, going: /雨|雪/u.test(text) ? '稍重' : '良' }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Picks the Tokyo-area entry whose forecast date is `day` (JST) from the JMA forecast JSON. */
export const parseTokyoForecast = (value: unknown, day: string): RaceDayWeather | null => {
  if (!Array.isArray(value) || !isRecord(value[0])) return null
  const report = value[0]
  if (typeof report.reportDatetime !== 'string' || !Array.isArray(report.timeSeries)) return null
  const series = report.timeSeries[0]
  if (!isRecord(series) || !Array.isArray(series.timeDefines) || !Array.isArray(series.areas)) return null
  const area = series.areas.find((item) => isRecord(item) && isRecord(item.area) && item.area.code === TOKYO_AREA_CODE)
  if (!isRecord(area) || !Array.isArray(area.weatherCodes) || !Array.isArray(area.weathers)) return null
  const index = series.timeDefines.findIndex((time) => typeof time === 'string' && time.slice(0, 10) === day)
  if (index < 0) return null
  const code = area.weatherCodes[index]
  const text = area.weathers[index]
  if (typeof code !== 'string' || typeof text !== 'string' || text.length > 200) return null
  const mapped = goingFromForecast(code, text)
  if (!mapped) return null
  return { area: '東京', ...mapped, reportDatetime: report.reportDatetime.slice(0, 25) }
}

export const fetchRaceDay = async (
  nowMs: number,
  fetchImpl: typeof fetch = fetch,
): Promise<RaceDayResponse> => {
  const day = jstDayFromMs(nowMs)
  try {
    const response = await fetchImpl(JMA_TOKYO_FORECAST_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(JMA_FETCH_TIMEOUT_MS),
      cf: { cacheTtl: JMA_EDGE_CACHE_TTL_SEC, cacheEverything: true },
    } as RequestInit)
    if (!response.ok) return { ok: true, day, weather: null }
    return { ok: true, day, weather: parseTokyoForecast(await response.json(), day) }
  } catch {
    return { ok: true, day, weather: null }
  }
}
