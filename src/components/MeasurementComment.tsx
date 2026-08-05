import type { MeasurementCommentResult } from '../lib/measurementEvaluation'

interface MeasurementCommentProps {
  comment: MeasurementCommentResult
}

export const MeasurementComment = ({ comment }: MeasurementCommentProps) => (
  <section className={`result-panel measurement-comment measurement-comment--${comment.status}`} aria-labelledby="comment-title">
    <div className="result-panel__heading">
      <div>
        <span className="result-panel__eyebrow">MEASUREMENT NOTE</span>
        <h3 id="comment-title">{comment.title}</h3>
      </div>
    </div>
    <p className="measurement-comment__message">{comment.message}</p>
    {comment.suggestions.length > 0 && (
      <ul className="measurement-comment__suggestions">
        {comment.suggestions.slice(0, 2).map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
      </ul>
    )}
    <p className="result-note">1回の速度測定だけで、回線や機器の故障・原因を特定することはできません。</p>
  </section>
)
