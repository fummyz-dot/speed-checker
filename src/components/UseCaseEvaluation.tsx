import type { UseCaseEvaluationResult } from '../types/measurement'
import { EVALUATION_LABELS } from '../lib/measurementEvaluation'

interface UseCaseEvaluationProps {
  evaluations: UseCaseEvaluationResult[]
}

const levelSymbols: Record<UseCaseEvaluationResult['level'], string> = {
  comfortable: '◎',
  available: '○',
  difficult: '△',
  unknown: '—',
}

export const UseCaseEvaluation = ({ evaluations }: UseCaseEvaluationProps) => (
  <section className="result-panel" aria-labelledby="evaluation-title">
    <div className="result-panel__heading">
      <div>
        <span className="result-panel__eyebrow">USE CASES</span>
        <h3 id="evaluation-title">用途別の参考評価</h3>
      </div>
    </div>
    <div className="evaluation-grid">
      {evaluations.map((evaluation) => (
        <article className={`evaluation-card evaluation-card--${evaluation.level}`} key={evaluation.id}>
          <span className="evaluation-card__symbol" aria-hidden="true">{levelSymbols[evaluation.level]}</span>
          <h4>{evaluation.label}</h4>
          <strong>{EVALUATION_LABELS[evaluation.level]}</strong>
          <p>{evaluation.detail}</p>
        </article>
      ))}
    </div>
    <p className="result-note">用途別評価は今回の測定値を基にした目安です。実際の品質は、利用サービス、時間帯、通信経路、端末などによって変わります。</p>
  </section>
)
