import { addDays, getLatestRankingSummary, type RaceRecord, type RankingPlacing } from '../../lib/raceRecord'
import { formatFinalSpeedDisplay } from '../../lib/speedValue'

interface RaceRecordPanelProps {
  record: RaceRecord
  today: string
  showRanking: boolean
}

const formatDay = (day: string, today: string): string => {
  if (day === addDays(today, -1)) return '昨日'
  const [, month, date] = day.split('-')
  return `${Number(month)}/${Number(date)}`
}

const Placing = ({ placing }: { placing: RankingPlacing }) => (
  <>
    <b>{placing.tieCount > 1 ? `同率${placing.rank}位` : `${placing.rank}位`}</b>
    <span className="race-record__field">／{placing.totalRuns.toLocaleString('ja-JP')}走</span>
  </>
)

export const RaceRecordPanel = ({ record, today, showRanking }: RaceRecordPanelProps) => {
  if (record.starts === 0) return null
  const latest = showRanking ? getLatestRankingSummary(record, today) : null

  return (
    <section className="race-record" aria-labelledby="race-record-title">
      <h2 className="race-record__title" id="race-record-title">あなたの戦績</h2>
      {latest?.kind === 'final' && (
        <p className="race-record__latest">
          <span className="race-record__label">{formatDay(latest.rankingDay, today)}の最終順位</span>
          <Placing placing={latest.placing} />
        </p>
      )}
      {latest?.kind === 'today' && (
        <p className="race-record__latest">
          <span className="race-record__label">本日の順位（出走時点）</span>
          <Placing placing={latest.placing} />
          <small>最終順位は明日わかります</small>
        </p>
      )}
      <dl className="race-record__stats">
        <div>
          <dt>通算</dt>
          <dd>{record.starts.toLocaleString('ja-JP')}戦</dd>
        </div>
        {record.bestDownloadMbps !== null && (
          <div>
            <dt>自己ベスト（下り）</dt>
            <dd>{formatFinalSpeedDisplay(record.bestDownloadMbps)} Mbps</dd>
          </div>
        )}
        {showRanking && record.rankingStartCount > 0 && (
          <div>
            <dt>ランキング</dt>
            <dd>
              {record.rankingStartCount.toLocaleString('ja-JP')}戦
              {record.bestFinal && `・最高${record.bestFinal.rank}位`}
            </dd>
          </div>
        )}
      </dl>
    </section>
  )
}
