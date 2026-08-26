import { useEffect, useMemo, useState } from 'react'
import type { SpeedMeasurementResult } from '../types/measurement'
import { evaluateUseCases, generateMeasurementComment } from '../lib/measurementEvaluation'
import { clearMeasurements, loadMeasurements, saveMeasurement } from '../lib/measurementStorage'
import { normalizeConditionLabel } from '../lib/measurementValidation'
import { MeasurementComment } from './MeasurementComment'
import { LoadedLatencyResponsiveness } from './LoadedLatencyResponsiveness'
import { MeasurementHistoryTrend } from './MeasurementHistoryTrend'
import { PreviousMeasurementComparison } from './PreviousMeasurementComparison'
import { ShareResultButton } from './ShareResultButton'
import { UseCaseEvaluation } from './UseCaseEvaluation'

interface CompletedMeasurementProps {
  result: SpeedMeasurementResult
}

export const CompletedMeasurement = ({ result }: CompletedMeasurementProps) => {
  const [previous, setPrevious] = useState<SpeedMeasurementResult | null>(null)
  const [history, setHistory] = useState<SpeedMeasurementResult[]>([])
  const [savedResultId, setSavedResultId] = useState<string | null>(null)
  const evaluations = useMemo(() => evaluateUseCases(result), [result])
  const comment = useMemo(() => generateMeasurementComment(result), [result])
  const conditionLabel = normalizeConditionLabel(result.conditionLabel)
  const isSavedToHistory = savedResultId === result.id

  useEffect(() => {
    const oldHistory = loadMeasurements()
    const updatedHistory = saveMeasurement(result)
    setPrevious(oldHistory.find((item) => item.id !== result.id) ?? null)
    setHistory(updatedHistory)
    setSavedResultId(updatedHistory.some((item) => item.id === result.id) ? result.id : null)
  }, [result])

  const clearHistory = () => {
    if (!window.confirm('このブラウザに保存された測定履歴を削除しますか？')) return
    clearMeasurements()
    setPrevious(null)
    setHistory([])
  }

  return (
    <div className="completed-measurement">
      {conditionLabel && (
        <section className="completed-condition-label" aria-labelledby="completed-condition-label-title">
          <span className="completed-condition-label__eyebrow" id="completed-condition-label-title">今回の測定条件</span>
          <div className="completed-condition-label__value">
            <strong>{conditionLabel}</strong>
            {isSavedToHistory && <span className="completed-condition-label__saved">履歴に保存</span>}
          </div>
        </section>
      )}
      <LoadedLatencyResponsiveness result={result} />
      <UseCaseEvaluation evaluations={evaluations} />
      <MeasurementComment comment={comment} />
      <PreviousMeasurementComparison current={result} previous={previous} onClear={clearHistory} />
      <MeasurementHistoryTrend history={history} currentResult={result} />
      <ShareResultButton result={result} evaluations={evaluations} />
    </div>
  )
}
