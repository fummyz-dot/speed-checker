import { useEffect, useRef, useState } from 'react'
import type { SpeedMeasurementResult } from '../../types/measurement'
import { requestRankingTurnstileToken } from './turnstile'
import type { RankingContext, RankingService, RankingSubmissionResult } from './types'

type RankingSubmitState = 'idle' | 'submitting' | 'success' | 'error' | 'notEligible' | 'missingMetrics'

interface RankingCardProps {
  context: RankingContext | null
  service: RankingService | null
  measurement: SpeedMeasurementResult
}

const formatScore = (scoreTenths: number): string => (scoreTenths / 10).toFixed(1)

const initialState = (context: RankingContext | null): RankingSubmitState => {
  if (context === null) return 'error'
  return context.rankingAvailable ? 'idle' : 'notEligible'
}

export const RankingCard = ({ context, service, measurement }: RankingCardProps) => {
  const [state, setState] = useState<RankingSubmitState>(() => initialState(context))
  const [submission, setSubmission] = useState<RankingSubmissionResult | null>(null)
  const turnstileContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setState(initialState(context))
    setSubmission(null)
  }, [context, measurement.id])

  const submit = async () => {
    if (!service || state === 'submitting') return
    if (measurement.pingMs == null || measurement.jitterMs == null) {
      setState('missingMetrics')
      return
    }

    setState('submitting')
    try {
      const container = turnstileContainerRef.current
      if (!container) throw new Error('Turnstile container is unavailable')
      const turnstileToken = await requestRankingTurnstileToken(container)
      const nextSubmission = await service.submitMeasurement(measurement, turnstileToken)
      setSubmission(nextSubmission)
      setState('success')
    } catch {
      setState('error')
    }
  }

  const scoreDifference = submission?.champion.source === 'previous_day_winner'
    && submission.champion.scoreTenths !== null
    ? submission.champion.scoreTenths - submission.entry.scoreTenths
    : null

  return (
    <section className="ranking-card result-panel" aria-labelledby="ranking-title">
      <div className="ranking-card__heading">
        <div>
          <span className="result-panel__eyebrow">RANKING</span>
          <h3 id="ranking-title">本日の全国回線品質ランキング</h3>
        </div>
        <span className="ranking-card__score-label">NET SPEED SCORE</span>
      </div>

      {state === 'notEligible' && (
        <p className="ranking-card__message">
          本日の全国回線品質ランキングは、現在Cloudflareにより日本国内と判定された測定のみ参加できます。
        </p>
      )}

      {state === 'missingMetrics' && (
        <p className="ranking-card__message" role="status">
          今回の測定ではPingまたはJitterを取得できなかったため、ランキングには参加できません。
        </p>
      )}

      {state === 'idle' && (
        <div className="ranking-card__intro">
          <div className="ranking-card__invite">
            <strong>あなたの結果は全国で何位？</strong>
            <span>匿名・任意参加。参加するとNet Speed Scoreと今日の順位を確認できます。</span>
          </div>
          <button className="secondary-button ranking-card__submit ranking-card__submit--attention" type="button" onClick={() => void submit()}>
            全国ランキングに参加して順位を見る
          </button>
          <p>
            Net Speed Scoreは、Download・Upload・Ping・Jitterから、速度だけでなく応答性や安定性も含めて評価するNet Speed Race独自の総合指標です。一つの指標だけが突出していても高得点になりにくいよう設計しています。
          </p>
          <small>ランキングへの参加は任意です。参加しない場合、測定結果はこれまでどおりブラウザ内だけで扱います。</small>
          <small>Net Speed ScoreはNet Speed Race独自の参考指標であり、Cloudflareその他の事業者が定める公式なネットワーク品質基準ではありません。</small>
        </div>
      )}

      {state === 'submitting' && (
        <button className="secondary-button ranking-card__submit" type="button" disabled>
          ランキングに登録中…
        </button>
      )}

      {state === 'error' && (
        <div className="ranking-card__error" role="status">
          <p>ランキングを利用できませんでした。測定結果には影響ありません。</p>
          {context?.rankingAvailable && service && (
            <button className="text-button" type="button" onClick={() => void submit()}>もう一度試す</button>
          )}
        </div>
      )}

      <div className="ranking-card__turnstile" ref={turnstileContainerRef} />

      {state === 'success' && submission && (
        <div className="ranking-card__success">
          <div className="ranking-card__result">
            <span>NET SPEED SCORE</span>
            <strong>{formatScore(submission.entry.scoreTenths)}</strong>
            <p>
              本日 {submission.entry.totalRuns.toLocaleString('ja-JP')}走中
              <b>{submission.entry.tieCount > 1 ? `同率${submission.entry.rank}位` : `${submission.entry.rank}位`}</b>
            </p>
            {submission.entry.topPercentTenths !== null && (
              <p>上位{(submission.entry.topPercentTenths / 10).toFixed(1)}%</p>
            )}
          </div>

          <section className="ranking-card__top3" aria-labelledby="ranking-top3-title">
            <h4 id="ranking-top3-title">TODAY&apos;S TOP 3</h4>
            <span>NET SPEED SCORE</span>
            <ol>
              {submission.top3.slice(0, 3).map((entry, index) => (
                <li key={`${entry.rank}-${entry.scoreTenths}-${index}`}>
                  <b>{entry.rank}位</b><span>{formatScore(entry.scoreTenths)}</span>
                </li>
              ))}
            </ol>
          </section>

          {scoreDifference !== null && (
            <section className="ranking-card__champion-comparison" aria-label="無敗の三冠馬との比較">
              <span>あなた: {formatScore(submission.entry.scoreTenths)}</span>
              <span>無敗の三冠馬: {formatScore(submission.champion.scoreTenths as number)}</span>
              <strong>
                {scoreDifference > 0
                  ? `差: ${formatScore(scoreDifference)}`
                  : scoreDifference < 0
                    ? `無敗の三冠馬を上回る総合スコア！ (+${formatScore(Math.abs(scoreDifference))})`
                    : '無敗の三冠馬と同じ総合スコア'}
              </strong>
            </section>
          )}
        </div>
      )}
    </section>
  )
}
