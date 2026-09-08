import { useEffect, useState } from 'react'
import type { SpeedMeasurementResult } from '../../types/measurement'
import {
  isRunMeasurementEligible,
  issueRunTicket,
  RunTicketIssueError,
} from './runTicketService'
import { saveRunTicket } from './runTicketStorage'
import type { IssuedRunTicket } from './types'

type LaunchState = 'idle' | 'loading' | 'error' | 'missing-metrics' | 'ineligible'

interface RunLaunchCardProps {
  measurement: SpeedMeasurementResult
  issue?: (measurement: SpeedMeasurementResult) => Promise<IssuedRunTicket>
  save?: (issued: IssuedRunTicket) => unknown
  navigate?: () => void
}

const defaultNavigate = () => window.location.assign('/run/')

export const RunLaunchCard = ({
  measurement,
  issue = issueRunTicket,
  save = saveRunTicket,
  navigate = defaultNavigate,
}: RunLaunchCardProps) => {
  const eligible = isRunMeasurementEligible(measurement)
  const [state, setState] = useState<LaunchState>(eligible ? 'idle' : 'missing-metrics')

  useEffect(() => {
    setState(eligible ? 'idle' : 'missing-metrics')
  }, [eligible, measurement.id])

  const launch = async () => {
    if (!eligible || state === 'loading') return
    setState('loading')
    try {
      const issued = await issue(measurement)
      save(issued)
      navigate()
    } catch (error) {
      setState(error instanceof RunTicketIssueError
        && error.code === 'MEASUREMENT_NOT_ELIGIBLE'
        ? 'ineligible'
        : 'error')
    }
  }

  const unavailableMessage = 'Pingまたはジッターを取得できなかったため、今回はNet Speed Runを開始できません。もう一度測定すると利用できる場合があります。'

  return (
    <section className="run-launch-card" aria-labelledby="run-launch-title">
      <div className="run-launch-card__copy">
        <span className="run-launch-card__eyebrow">NET SPEED RUN</span>
        <h3 id="run-launch-title">この測定結果で走る</h3>
        <p>今回の測定結果から持ち時間が決まります。ジャンプだけでGOALを目指します。</p>
      </div>
      <div className="run-launch-card__action">
        <button
          className="run-launch-card__button"
          type="button"
          disabled={!eligible || state === 'loading' || state === 'ineligible'}
          onClick={() => void launch()}
        >
          {state === 'loading' ? 'ゲームを準備中…' : 'NET SPEED RUNを開始'}
        </button>
        {state === 'missing-metrics' && <p className="run-launch-card__note">{unavailableMessage}</p>}
        {state === 'ineligible' && (
          <p className="run-launch-card__note">
            今回の測定結果ではNet Speed Runを開始できません。もう一度測定してお試しください。
          </p>
        )}
        {state === 'error' && (
          <p className="run-launch-card__error" role="alert">
            ゲームを準備できませんでした。もう一度お試しください。
          </p>
        )}
      </div>
    </section>
  )
}
