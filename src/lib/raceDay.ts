/**
 * Today's main race, the same for everyone: a fictional race name that rotates by JST date, and
 * (when available) Tokyo's weather from the JMA forecast turned into a going by the Worker.
 */
export const RACE_NAMES = [
  '光回線ステークス',
  'パケット記念',
  '帯域カップ',
  'レイテンシ賞',
  'ジッターハンデキャップ',
  'ルーター特別',
  'Wi-Fiステークス',
  'アップリンク記念',
  'ゲートウェイ賞',
  'ファイバーカップ',
] as const

export type Going = '良' | '稍重' | '重' | '不良'
export type WeatherLabel = '晴れ' | 'くもり' | '雨' | '雪'

export interface RaceDayWeather {
  area: '東京'
  label: WeatherLabel
  going: Going
  reportDatetime: string
}

export interface RaceDay {
  day: string
  raceName: string
  weather: RaceDayWeather | null
}

export const GOING_CLASS: Record<Going, 'good' | 'yielding' | 'heavy' | 'bad'> = {
  良: 'good',
  稍重: 'yielding',
  重: 'heavy',
  不良: 'bad',
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u

export const jstDayFromMs = (nowMs: number): string =>
  new Date(nowMs + JST_OFFSET_MS).toISOString().slice(0, 10)

export const getRaceName = (day: string): string => {
  const dayNumber = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000)
  const index = ((dayNumber % RACE_NAMES.length) + RACE_NAMES.length) % RACE_NAMES.length
  return RACE_NAMES[Number.isFinite(index) ? index : 0]
}

export const createRaceDay = (day: string, weather: RaceDayWeather | null = null): RaceDay => ({
  day,
  raceName: getRaceName(day),
  weather,
})

const WEATHER_LABELS: readonly WeatherLabel[] = ['晴れ', 'くもり', '雨', '雪']
const GOINGS: readonly Going[] = ['良', '稍重', '重', '不良']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Accepts the Worker's `/api/race-day` response for `day` only; anything else means no weather. */
export const parseRaceDayWeather = (value: unknown, day: string): RaceDayWeather | null => {
  if (!isRecord(value) || value.ok !== true || value.day !== day || !DAY_PATTERN.test(day)) return null
  const weather = value.weather
  if (!isRecord(weather)
    || weather.area !== '東京'
    || !WEATHER_LABELS.includes(weather.label as WeatherLabel)
    || !GOINGS.includes(weather.going as Going)
    || typeof weather.reportDatetime !== 'string') {
    return null
  }
  return {
    area: '東京',
    label: weather.label as WeatherLabel,
    going: weather.going as Going,
    reportDatetime: weather.reportDatetime,
  }
}

/** One line for posts: 「光回線ステークス（東京 雨・馬場 重）」. */
export const formatRaceDayLine = (raceDay: RaceDay): string =>
  raceDay.weather
    ? `${raceDay.raceName}（${raceDay.weather.area} ${raceDay.weather.label}・馬場 ${raceDay.weather.going}）`
    : raceDay.raceName

export const JMA_TOKYO_FORECAST_PAGE = 'https://www.jma.go.jp/bosai/forecast/#area_type=offices&area_code=130000'
