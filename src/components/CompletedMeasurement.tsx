import { useEffect, useMemo, useState } from 'react'
import type { SpeedMeasurementResult } from '../types/measurement'
import { evaluateUseCases, generateMeasurementComment } from '../lib/measurementEvaluation'
import { clearMeasurements, loadMeasurements, saveMeasurement } from '../lib/measurementStorage'
import { MeasurementComment } from './MeasurementComment'
import { PreviousMeasurementComparison } from './PreviousMeasurementComparison'
import { ShareResultButton } from './ShareResultButton'
import { UseCaseEvaluation } from './UseCaseEvaluation'

interface CompletedMeasurementProps {
  result: SpeedMeasurementResult
}

export const CompletedMeasurement = ({ result }: CompletedMeasurementProps) => {
  const [previous, setPrevious] = useState<SpeedMeasurementResult | null>(null)
  const evaluations = useMemo(() => evaluateUseCases(result), [result])
  const comment = useMemo(() => generateMeasurementComment(result), [result])

  useEffect(() => {
    const history = loadMeasurements()
    setPrevious(history.find((item) => item.id !== result.id) ?? null)
    saveMeasurement(result)
  }, [result])

  const clearHistory = () => {
    if (!window.confirm('このブラウザに保存された測定履歴を削除しますか？')) return
    clearMeasurements()
    setPrevious(null)
  }

  return (
    <div className="completed-measurement">
      <UseCaseEvaluation evaluations={evaluations} />
      <MeasurementComment comment={comment} />
      <PreviousMeasurementComparison current={result} previous={previous} onClear={clearHistory} />
      <ShareResultButton result={result} evaluations={evaluations} />
    </div>
  )
}
