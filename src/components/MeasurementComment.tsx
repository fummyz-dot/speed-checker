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
    <p className="result-note">1回の速度測定だけで、回線や機器の故障・原因を特定することはできません。</p>
    <div className="measurement-comment__next">
      <h4>次に試すこと</h4>
      <p>同じ条件で2〜3回測った後、比較条件を1つ変えて再測定すると違いを比べやすくなります。例：Wi-Fi／有線、部屋、朝／夜。</p>
      <a className="result-guide-link" href="/lab/ping-jitter-14-runs/">実測14回でPing・Jitterの変動を見る</a>
      {comment.suggestions.length > 0 && (
        <ul className="measurement-comment__suggestions">
          {comment.suggestions.slice(0, 2).map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
        </ul>
      )}
      <a className="result-guide-link" href="#measurement-condition-edit">比較条件を変えて再測定する</a>
    </div>
  </section>
)
