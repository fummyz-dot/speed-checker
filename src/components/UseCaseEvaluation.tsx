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
        <h3 id="evaluation-title">用途別の目安</h3>
      </div>
    </div>
    <div className="evaluation-grid">
      {evaluations.map((evaluation) => (
        <article className={`evaluation-card evaluation-card--${evaluation.level}`} key={evaluation.id}>
          <span className="evaluation-card__symbol" aria-hidden="true">{levelSymbols[evaluation.level]}</span>
          <h4>{evaluation.label}</h4>
          <strong>{EVALUATION_LABELS[evaluation.level]}</strong>
          {evaluation.level !== 'comfortable' && <p>{evaluation.reason ?? evaluation.detail}</p>}
          {evaluation.id === 'meeting' && (
            <a className="result-guide-link" href="/video-call/">Web会議の判定基準を見る</a>
          )}
          {evaluation.id === 'gaming' && (
            <a className="result-guide-link" href="/gaming/">ゲーム向けの判定基準を見る</a>
          )}
        </article>
      ))}
    </div>
    <p className="result-note">今回の測定値から見た目安です。</p>
  </section>
)
