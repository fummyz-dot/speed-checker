import type { MeasurementCommentResult } from '../lib/measurementEvaluation'

interface MeasurementCommentProps {
  comment: MeasurementCommentResult
}

export const MeasurementComment = ({ comment }: MeasurementCommentProps) => (
  <section className={`result-panel measurement-comment measurement-comment--${comment.status}`} aria-labelledby="comment-title">
    <div className="result-panel__heading">
      <div>
        <h3 id="comment-title">{comment.title}</h3>
      </div>
    </div>
    <p className="measurement-comment__message">{comment.message}</p>
  </section>
)
