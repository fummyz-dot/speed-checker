import { describe, expect, it } from 'vitest'
import type { SpeedMeasurementResult } from '../types/measurement'
import {
  clearMeasurements,
  loadMeasurements,
  MAX_MEASUREMENT_HISTORY,
  MEASUREMENT_STORAGE_KEY,
  saveMeasurement,
} from './measurementStorage'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(key: string) { return this.data.get(key) ?? null }
  key(index: number) { return [...this.data.keys()][index] ?? null }
  removeItem(key: string) { this.data.delete(key) }
  setItem(key: string, value: string) { this.data.set(key, value) }
}

const measurement = (id: string, value = 10): SpeedMeasurementResult => ({
  id,
  measuredAt: new Date(2026, 7, 3, 12, 0, Number(id) || 0).toISOString(),
  downloadMbps: value,
  uploadMbps: value / 2,
  pingMs: 20,
})

describe('measurementStorage', () => {
  it('初回は空の履歴を返す', () => {
    expect(loadMeasurements(new MemoryStorage())).toEqual([])
  })

  it('前回結果を新しい順で保存する', () => {
    const storage = new MemoryStorage()
    saveMeasurement(measurement('1'), storage)
    saveMeasurement(measurement('2'), storage)
    expect(loadMeasurements(storage).map(({ id }) => id)).toEqual(['2', '1'])
  })

  it(`保存上限を${MAX_MEASUREMENT_HISTORY}件にする`, () => {
    const storage = new MemoryStorage()
    for (let index = 0; index < 35; index += 1) saveMeasurement(measurement(String(index)), storage)
    expect(loadMeasurements(storage)).toHaveLength(30)
    expect(loadMeasurements(storage)[0].id).toBe('34')
  })

  it('同じIDを重複保存しない', () => {
    const storage = new MemoryStorage()
    saveMeasurement(measurement('1'), storage)
    saveMeasurement(measurement('1'), storage)
    expect(loadMeasurements(storage)).toHaveLength(1)
  })

  it('LocalStorage例外でも測定側へ例外を伝播しない', () => {
    const storage = new MemoryStorage()
    storage.getItem = () => { throw new Error('blocked') }
    storage.setItem = () => { throw new Error('blocked') }
    storage.removeItem = () => { throw new Error('blocked') }
    expect(loadMeasurements(storage)).toEqual([])
    expect(saveMeasurement(measurement('1'), storage)).toEqual([])
    expect(clearMeasurements(storage)).toBe(false)
  })

  it('履歴を削除する', () => {
    const storage = new MemoryStorage()
    saveMeasurement(measurement('1'), storage)
    expect(clearMeasurements(storage)).toBe(true)
    expect(storage.getItem(MEASUREMENT_STORAGE_KEY)).toBeNull()
  })
})
