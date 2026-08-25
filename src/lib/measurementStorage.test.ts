import { describe, expect, it } from 'vitest'
import type { SpeedMeasurementResult } from '../types/measurement'
import {
  clearMeasurements,
  getRecentConditionLabels,
  loadMeasurements,
  MAX_RECENT_CONDITION_LABELS,
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

const setHistory = (storage: Storage, records: unknown[]): void => {
  storage.setItem(MEASUREMENT_STORAGE_KEY, JSON.stringify(records))
}

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

  it('Storage keyをv1のまま維持する', () => {
    expect(MEASUREMENT_STORAGE_KEY).toBe('speed-checker:measurements:v1')
  })

  it('optional指標のないLegacy履歴を読み込む', () => {
    const storage = new MemoryStorage()
    const legacy = measurement('legacy')
    setHistory(storage, [legacy])

    expect(loadMeasurements(storage)).toEqual([legacy])
    expect(loadMeasurements(storage)[0].conditionLabel).toBeUndefined()
  })

  it('有効な測定条件ラベルをtrimして保存・読込する', () => {
    const storage = new MemoryStorage()
    saveMeasurement({ ...measurement('condition'), conditionLabel: '  リビング 5GHz  ' }, storage)

    expect(loadMeasurements(storage)).toEqual([{
      ...measurement('condition'),
      conditionLabel: 'リビング 5GHz',
    }])
  })

  it.each([
    ['空文字', ''],
    ['空白のみ', '     '],
    ['null', null],
    ['25文字以上', 'あ'.repeat(25)],
    ['number', 123],
    ['object', {}],
    ['array', []],
  ])('不正または未設定の測定条件ラベル（%s）だけをnullとして履歴本体を保持する', (_description, conditionLabel) => {
    const storage = new MemoryStorage()
    setHistory(storage, [{ ...measurement('unconfigured'), conditionLabel }])

    expect(loadMeasurements(storage)).toEqual([{
      ...measurement('unconfigured'),
      conditionLabel: null,
    }])
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

  it('最近使った条件を最新順・重複なしで最大5件にする', () => {
    const history = [
      { ...measurement('1'), conditionLabel: '  リビング 5GHz  ' },
      { ...measurement('2'), conditionLabel: '有線LAN' },
      { ...measurement('3'), conditionLabel: 'リビング 5GHz' },
      measurement('4'),
      { ...measurement('5'), conditionLabel: null },
      { ...measurement('6'), conditionLabel: '寝室 5GHz' },
      { ...measurement('7'), conditionLabel: 'iPhone テザリング' },
      { ...measurement('8'), conditionLabel: '書斎 5GHz' },
      { ...measurement('9'), conditionLabel: '廊下 5GHz' },
    ]

    expect(getRecentConditionLabels(history)).toEqual([
      'リビング 5GHz',
      '有線LAN',
      '寝室 5GHz',
      'iPhone テザリング',
      '書斎 5GHz',
    ])
    expect(getRecentConditionLabels(history)).toHaveLength(MAX_RECENT_CONDITION_LABELS)
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
