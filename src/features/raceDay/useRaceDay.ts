import { createContext, useContext, useEffect, useState } from 'react'
import { createRaceDay, jstDayFromMs, parseRaceDayWeather, type RaceDay } from '../../lib/raceDay'

const RACE_DAY_TIMEOUT_MS = 3000

/**
 * The race name is computed locally; the Tokyo weather comes from `/api/race-day` once per page
 * load when the Worker API is available. A failed lookup simply leaves the weather out.
 */
export const useRaceDay = (fetchWeather: boolean): RaceDay => {
  const [raceDay, setRaceDay] = useState<RaceDay>(() => createRaceDay(jstDayFromMs(Date.now())))

  useEffect(() => {
    if (!fetchWeather) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), RACE_DAY_TIMEOUT_MS)
    const day = raceDay.day
    fetch('/api/race-day', {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((value: unknown) => {
        const weather = parseRaceDayWeather(value, day)
        if (weather) setRaceDay(createRaceDay(day, weather))
      })
      .catch(() => {
        // Weather is decoration; the race runs without it.
      })
      .finally(() => window.clearTimeout(timeout))
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [fetchWeather, raceDay.day])

  return raceDay
}

export const RaceDayContext = createContext<RaceDay | null>(null)

export const useRaceDayContext = (): RaceDay | null => useContext(RaceDayContext)
