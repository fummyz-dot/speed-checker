import { describe, expect, it } from 'vitest'
import { formatDownloadPosition, getDownloadPosition } from './downloadPosition'

const distribution = {
  windowDays: 30,
  totalRuns: 120,
  // 10%..90% cut points in Mbps x10: 50, 100, ..., 450 Mbps
  decilesTenths: [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500],
}

describe('getDownloadPosition', () => {
  it.each([
    [600, '上位', 10],
    [450, '上位', 10],
    [449.9, '上位', 20],
    [250, '上位', 50],
    [249.9, '下位', 50],
    [120, '下位', 30],
    [49.9, '下位', 10],
    [0, '下位', 10],
  ])('%s Mbpsは%s%s%%以内', (mbps, side, within) => {
    expect(getDownloadPosition(mbps, distribution)).toMatchObject({ side, withinPercent: within })
  })

  it('分布や測定値がない場合は表示しない', () => {
    expect(getDownloadPosition(300, null)).toBeNull()
    expect(getDownloadPosition(null, distribution)).toBeNull()
    expect(getDownloadPosition(Number.NaN, distribution)).toBeNull()
    expect(getDownloadPosition(300, { ...distribution, decilesTenths: [1, 2] })).toBeNull()
  })

  it('期間と件数を添えた文にする', () => {
    const position = getDownloadPosition(400, distribution)
    expect(position && formatDownloadPosition(position)).toBe('直近30日の出走120件のうち、下り速度は上位20%以内')
  })
})
