import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RaceRecord } from '../../lib/raceRecord'
import { RaceRecordPanel } from './RaceRecordPanel'

const baseRecord: RaceRecord = {
  starts: 12,
  bestDownloadMbps: 512.4,
  rankingStartCount: 3,
  bestFinal: { rank: 2, tieCount: 1, totalRuns: 9, rankingDay: '2026-10-01' },
  rankingStarts: [{
    measurementId: 'a',
    rankingDay: '2026-10-11',
    scoreTenths: 5000,
    atEntry: { rank: 3, tieCount: 1, totalRuns: 10 },
    final: { rank: 4, tieCount: 1, totalRuns: 15 },
  }],
  lastMeasurementId: null,
  lastWasBestDownload: false,
}

describe('RaceRecordPanel', () => {
  it('昨日の最終順位と戦績を表示する', () => {
    render(<RaceRecordPanel record={baseRecord} today="2026-10-12" showRanking />)
    const panel = screen.getByRole('region', { name: 'あなたの戦績' })
    expect(panel).toHaveTextContent('昨日の最終順位4位／15走')
    expect(panel).toHaveTextContent('通算12戦')
    expect(panel).toHaveTextContent('自己ベスト（下り）512 Mbps')
    expect(panel).toHaveTextContent('ランキング3戦・最高2位')
  })

  it('昨日より前の出走は日付で表示し、同率を示す', () => {
    const record: RaceRecord = {
      ...baseRecord,
      rankingStarts: [{ ...baseRecord.rankingStarts[0], rankingDay: '2026-10-09', final: { rank: 2, tieCount: 2, totalRuns: 8 } }],
    }
    render(<RaceRecordPanel record={record} today="2026-10-12" showRanking />)
    expect(screen.getByRole('region', { name: 'あなたの戦績' })).toHaveTextContent('10/9の最終順位同率2位／8走')
  })

  it('本日の出走は出走時点の順位と、最終順位が明日わかることを示す', () => {
    const record: RaceRecord = {
      ...baseRecord,
      rankingStarts: [{ ...baseRecord.rankingStarts[0], rankingDay: '2026-10-12', final: null }],
    }
    render(<RaceRecordPanel record={record} today="2026-10-12" showRanking />)
    const panel = screen.getByRole('region', { name: 'あなたの戦績' })
    expect(panel).toHaveTextContent('本日の順位（出走時点）3位／10走')
    expect(panel).toHaveTextContent('最終順位は明日わかります')
  })

  it('ランキングが無効なときはランキングの行を出さない', () => {
    render(<RaceRecordPanel record={baseRecord} today="2026-10-12" showRanking={false} />)
    const panel = screen.getByRole('region', { name: 'あなたの戦績' })
    expect(panel).not.toHaveTextContent('最終順位')
    expect(panel).not.toHaveTextContent('ランキング')
  })

  it('まだ1戦もしていなければ何も表示しない', () => {
    const { container } = render(
      <RaceRecordPanel record={{ ...baseRecord, starts: 0 }} today="2026-10-12" showRanking />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
