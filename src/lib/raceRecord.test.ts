import { describe, expect, it } from 'vitest'
import type { SpeedMeasurementResult } from '../types/measurement'
import { MEASUREMENT_STORAGE_KEY, saveMeasurement } from './measurementStorage'
import {
  clearRaceRecord,
  getLatestRankingSummary,
  getPendingFinalLookups,
  jstDay,
  loadRaceRecord,
  RACE_RECORD_STORAGE_KEY,
  recordFinalPlacing,
  recordMeasurement,
  recordRankingStart,
} from './raceRecord'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(key: string) { return this.data.get(key) ?? null }
  key(index: number) { return [...this.data.keys()][index] ?? null }
  removeItem(key: string) { this.data.delete(key) }
  setItem(key: string, value: string) { this.data.set(key, value) }
}

const measurement = (id: string, downloadMbps: number): SpeedMeasurementResult => ({
  id,
  measuredAt: '2026-10-12T03:00:00.000Z',
  downloadMbps,
  uploadMbps: 50,
  pingMs: 10,
})

const start = (measurementId: string, rankingDay: string, rank = 3) => ({
  measurementId,
  rankingDay,
  scoreTenths: 5000,
  atEntry: { rank, tieCount: 1, totalRuns: 10 },
})

describe('raceRecord', () => {
  it('JSTの日付を返す', () => {
    expect(jstDay(Date.UTC(2026, 9, 11, 14, 59))).toBe('2026-10-11')
    expect(jstDay(Date.UTC(2026, 9, 11, 15, 0))).toBe('2026-10-12')
  })

  it('記録がないときは保存済みの測定履歴から通算と自己ベストを作る', () => {
    const storage = new MemoryStorage()
    saveMeasurement(measurement('a', 100), storage)
    saveMeasurement(measurement('b', 300), storage)
    expect(loadRaceRecord(storage)).toMatchObject({ starts: 2, bestDownloadMbps: 300, rankingStartCount: 0 })
  })

  it('初回の記録では、履歴に保存済みの今回分を二重に数えない', () => {
    const storage = new MemoryStorage()
    saveMeasurement(measurement('a', 100), storage)
    saveMeasurement(measurement('b', 150), storage)
    const outcome = recordMeasurement(measurement('b', 150), storage)
    expect(outcome.record).toMatchObject({ starts: 2, bestDownloadMbps: 150 })
    expect(outcome.isNewBestDownload).toBe(true)
  })

  it('最初の1回は自己ベスト更新にしない', () => {
    const storage = new MemoryStorage()
    const outcome = recordMeasurement(measurement('a', 100), storage)
    expect(outcome).toMatchObject({ isNewBestDownload: false, record: { starts: 1, bestDownloadMbps: 100 } })
  })

  it('同じ測定を何度記録しても1戦として数え、結果も変わらない', () => {
    const storage = new MemoryStorage()
    recordMeasurement(measurement('a', 100), storage)
    const first = recordMeasurement(measurement('b', 200), storage)
    const again = recordMeasurement(measurement('b', 200), storage)
    expect(first.isNewBestDownload).toBe(true)
    expect(again).toEqual(first)
    expect(loadRaceRecord(storage).starts).toBe(2)
  })

  it('自己ベストを下回った測定はベストを保つ', () => {
    const storage = new MemoryStorage()
    recordMeasurement(measurement('a', 300), storage)
    const outcome = recordMeasurement(measurement('b', 200), storage)
    expect(outcome).toMatchObject({ isNewBestDownload: false, record: { starts: 2, bestDownloadMbps: 300 } })
  })

  it('ランキング出走は同じ測定を重複登録しない', () => {
    const storage = new MemoryStorage()
    recordRankingStart(start('m1', '2026-10-11'), storage)
    recordRankingStart(start('m1', '2026-10-11'), storage)
    const record = loadRaceRecord(storage)
    expect(record.rankingStartCount).toBe(1)
    expect(record.rankingStarts).toHaveLength(1)
    expect(record.rankingStarts[0].final).toBeNull()
  })

  it('確定順位の照会対象は、終わった日のうち最新の日だけで、保持期間外は除く', () => {
    const storage = new MemoryStorage()
    recordRankingStart(start('old', '2026-09-01'), storage)
    recordRankingStart(start('d10', '2026-10-10'), storage)
    recordRankingStart(start('d11a', '2026-10-11'), storage)
    recordRankingStart(start('d11b', '2026-10-11'), storage)
    recordRankingStart(start('today', '2026-10-12'), storage)
    const pending = getPendingFinalLookups(loadRaceRecord(storage), '2026-10-12')
    expect(pending.map((item) => item.measurementId).sort()).toEqual(['d11a', 'd11b'])
  })

  it('確定順位を保存して最高着順を更新し、見つからない出走は一覧から外す', () => {
    const storage = new MemoryStorage()
    recordRankingStart(start('a', '2026-10-11'), storage)
    recordRankingStart(start('b', '2026-10-11'), storage)
    recordFinalPlacing('a', { rankingDay: '2026-10-11', placing: { rank: 4, tieCount: 1, totalRuns: 15 } }, storage)
    const record = recordFinalPlacing('b', null, storage)
    expect(record.rankingStarts.map((item) => item.measurementId)).toEqual(['a'])
    expect(record.rankingStartCount).toBe(2)
    expect(record.bestFinal).toEqual({ rank: 4, tieCount: 1, totalRuns: 15, rankingDay: '2026-10-11' })
    expect(getPendingFinalLookups(record, '2026-10-12')).toEqual([])
  })

  it('前回の出走は、本日分があれば出走時点、なければ最新の終わった日の最終着順を返す', () => {
    const storage = new MemoryStorage()
    recordRankingStart(start('a', '2026-10-11', 6), storage)
    recordRankingStart(start('b', '2026-10-11', 2), storage)
    recordFinalPlacing('a', { rankingDay: '2026-10-11', placing: { rank: 5, tieCount: 1, totalRuns: 20 } }, storage)
    recordFinalPlacing('b', { rankingDay: '2026-10-11', placing: { rank: 7, tieCount: 2, totalRuns: 20 } }, storage)
    expect(getLatestRankingSummary(loadRaceRecord(storage), '2026-10-12')).toEqual({
      kind: 'final', rankingDay: '2026-10-11', placing: { rank: 5, tieCount: 1, totalRuns: 20 },
    })

    recordRankingStart(start('c', '2026-10-12', 3), storage)
    expect(getLatestRankingSummary(loadRaceRecord(storage), '2026-10-12')).toEqual({
      kind: 'today', placing: { rank: 3, tieCount: 1, totalRuns: 10 },
    })
  })

  it('確定順位がまだない日は前回の出走を返さない', () => {
    const storage = new MemoryStorage()
    recordRankingStart(start('a', '2026-10-11'), storage)
    expect(getLatestRankingSummary(loadRaceRecord(storage), '2026-10-12')).toBeNull()
  })

  it('壊れた保存値は無視し、不正な出走だけを捨てる', () => {
    const storage = new MemoryStorage()
    storage.setItem(RACE_RECORD_STORAGE_KEY, '{broken')
    expect(loadRaceRecord(storage).starts).toBe(0)

    storage.setItem(RACE_RECORD_STORAGE_KEY, JSON.stringify({
      starts: 3,
      bestDownloadMbps: -1,
      rankingStartCount: 2,
      rankingStarts: [
        { ...start('ok', '2026-10-11'), final: null },
        { ...start('bad-day', '10/11'), final: null },
        { ...start('bad-rank', '2026-10-11'), atEntry: { rank: 11, tieCount: 1, totalRuns: 10 }, final: null },
      ],
    }))
    const record = loadRaceRecord(storage)
    expect(record).toMatchObject({ starts: 3, bestDownloadMbps: null, rankingStartCount: 2 })
    expect(record.rankingStarts.map((item) => item.measurementId)).toEqual(['ok'])
  })

  it('削除すると測定履歴とは独立に消える', () => {
    const storage = new MemoryStorage()
    recordMeasurement(measurement('a', 100), storage)
    clearRaceRecord(storage)
    expect(storage.getItem(RACE_RECORD_STORAGE_KEY)).toBeNull()
    expect(storage.getItem(MEASUREMENT_STORAGE_KEY)).toBeNull()
  })
})
