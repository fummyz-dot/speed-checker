import { useState } from 'react'
import type { SpeedMeasurementResult, UseCaseEvaluationResult } from '../types/measurement'
import {
  createShareFilename,
  createShareImageBlob,
  downloadBlob,
} from '../lib/shareImage'

interface ShareResultButtonProps {
  result: SpeedMeasurementResult
  evaluations: UseCaseEvaluationResult[]
}

export const ShareResultButton = ({ result, evaluations }: ShareResultButtonProps) => {
  const [isGenerating, setIsGenerating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const share = async () => {
    setIsGenerating(true)
    setMessage(null)
    try {
      const blob = await createShareImageBlob(result, evaluations)
      const filename = createShareFilename(result.measuredAt)
      const file = new File([blob], filename, { type: 'image/png' })
      const canShareFile = typeof navigator.share === 'function'
        && typeof navigator.canShare === 'function'
        && navigator.canShare({ files: [file] })

      if (canShareFile) {
        try {
          await navigator.share({
            files: [file],
            title: 'Speed Checker 測定結果',
            text: '今回のインターネット速度の測定結果です。',
          })
          return
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return
          downloadBlob(blob, filename)
          setMessage('共有画面を開けなかったため、PNG画像を保存しました。')
          return
        }
      }

      downloadBlob(blob, filename)
      setMessage('PNG画像を保存しました。')
    } catch {
      setMessage('画像を生成できませんでした。時間を置いてもう一度お試しください。')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <section className="share-result" aria-labelledby="share-title">
      <div>
        <span className="result-panel__eyebrow">SHARE</span>
        <h3 id="share-title">測定結果を残す</h3>
        <p>個人情報を含まない1200 × 630pxのPNGをブラウザ内で生成します。</p>
      </div>
      <button className="share-button" type="button" onClick={share} disabled={isGenerating}>
        {isGenerating ? '画像を生成中…' : '結果を画像で共有'}
      </button>
      {message && <p className="share-result__status" role="status">{message}</p>}
    </section>
  )
}
