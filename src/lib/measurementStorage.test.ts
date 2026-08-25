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

  it('24文字の測定条件ラベルを保存・読込する', () => {
    const storage = new MemoryStorage()
    const conditionLabel = 'あ'.repeat(24)
    setHistory(storage, [{ ...measurement('max-length'), conditionLabel }])

    expect(loadMeasurements(storage)).toEqual([{
      ...measurement('max-length'),
      conditionLabel,
    }])
  })

  it.each([
    ['空文字', ''],
    ['空白のみ', '     '],
    ['null', null],
  ])('未設定の測定条件ラベル（%s）をnullとして履歴本体を保持する', (_description, conditionLabel) => {
    const storage = new MemoryStorage()
    setHistory(storage, [{ ...measurement('unconfigured'), conditionLabel }])

    expect(loadMeasurements(storage)).toEqual([{
      ...measurement('unconfigured'),
      conditionLabel: null,
    }])
  })

  it.each([
    ['25文字以上', 'あ'.repeat(25)],
    ['number', 123],
    ['object', {}],
    ['array', []],
  ])('不正な測定条件ラベル（%s）だけをnullとして履歴本体を保持する', (_description, conditionLabel) => {
    const storage = new MemoryStorage()
    setHistory(storage, [{ ...measurement('invalid-condition'), conditionLabel }])

    expect(loadMeasurements(storage)).toEqual([{
      ...measurement('invalid-condition'),
      conditionLabel: null,
    }])
  })

  it('新しい測定結果のjitterとLoaded latencyを保存して読み込む', () => {
    const storage = new MemoryStorage()
    const current: SpeedMeasurementResult = {
      ...measurement('new'),
      jitterMs: 2.5,
      downloadLoadedLatencyMs: 35.2,
      uploadLoadedLatencyMs: 41.8,
      timezoneOffsetMinutes: -540,
    }

    saveMeasurement(current, storage)

    expect(JSON.parse(storage.getItem(MEASUREMENT_STORAGE_KEY) ?? 'null')).toEqual([current])
    expect(loadMeasurements(storage)).toEqual([current])
  })

  it('新しいoptional指標がすべてnullでも保存して読み込む', () => {
    const storage = new MemoryStorage()
    const current: SpeedMeasurementResult = {
      ...measurement('null-metrics'),
      jitterMs: null,
      downloadLoadedLatencyMs: null,
      uploadLoadedLatencyMs: null,
      timezoneOffsetMinutes: null,
    }

    saveMeasurement(current, storage)

    expect(JSON.parse(storage.getItem(MEASUREMENT_STORAGE_KEY) ?? 'null')).toEqual([current])
    expect(loadMeasurements(storage)).toEqual([current])
  })

  it('新旧形式が混在する履歴を順序を保って読み込む', () => {
    const storage = new MemoryStorage()
    const legacy = measurement('legacy')
    const current: SpeedMeasurementResult = {
      ...measurement('current'),
      jitterMs: 3,
      downloadLoadedLatencyMs: 27,
      uploadLoadedLatencyMs: 32,
      conditionLabel: '  有線LAN  ',
    }
    const anotherLegacy = measurement('another-legacy')
    const anotherCurrent: SpeedMeasurementResult = {
      ...measurement('another-current'),
      conditionLabel: '寝室 5GHz',
    }
    setHistory(storage, [legacy, current, anotherLegacy, anotherCurrent])

    expect(loadMeasurements(storage)).toEqual([
      legacy,
      { ...current, conditionLabel: '有線LAN' },
      anotherLegacy,
      anotherCurrent,
    ])
  })

  it('不正なoptional指標だけをnullへ正規化し、基本履歴を保持する', () => {
    const storage = new MemoryStorage()
    setHistory(storage, [{
      ...measurement('invalid-optional'),
      jitterMs: 'invalid',
      downloadLoadedLatencyMs: -1,
      uploadLoadedLatencyMs: { value: 20 },
    }])

    expect(loadMeasurements(storage)).toEqual([{
      ...measurement('invalid-optional'),
      jitterMs: null,
      downloadLoadedLatencyMs: null,
      uploadLoadedLatencyMs: null,
    }])
  })

  it('不正なtimezone offsetだけをnullへ正規化し、基本履歴を保持する', () => {
    const storage = new MemoryStorage()
    setHistory(storage, [{
      ...measurement('invalid-timezone'),
      timezoneOffsetMinutes: 900,
    }])

    expect(loadMeasurements(storage)).toEqual([{
      ...measurement('invalid-timezone'),
      timezoneOffsetMinutes: null,
    }])
  })

  it('必須の基本測定値が不正な履歴を除外する', () => {
    const storage = new MemoryStorage()
    const valid = measurement('valid')
    setHistory(storage, [
      { ...measurement('invalid'), downloadMbps: -1, jitterMs: 2 },
      valid,
    ])

    expect(loadMeasurements(storage)).toEqual([valid])
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

  it('不正またはLegacyのconditionLabelを最近使った条件へ含めない', () => {
    const history = [
      measurement('legacy'),
      { ...measurement('invalid-number'), conditionLabel: 123 as unknown as string },
      { ...measurement('invalid-long'), conditionLabel: 'あ'.repeat(25) },
      { ...measurement('valid'), conditionLabel: '有線LAN' },
    ]

    expect(getRecentConditionLabels(history)).toEqual(['有線LAN'])
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
