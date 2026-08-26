import { useState } from 'react'
import type { SpeedMeasurementResult, UseCaseEvaluationResult } from '../types/measurement'
import {
  createShareFilename,
  createShareImageBlob,
  downloadBlob,
} from '../lib/shareImage'
import { createSharePostText, createXIntentUrl } from '../lib/sharePost'

interface ShareResultButtonProps {
  result: SpeedMeasurementResult
  evaluations: UseCaseEvaluationResult[]
}

export const ShareResultButton = ({ result, evaluations }: ShareResultButtonProps) => {
  const [isCopyingImage, setIsCopyingImage] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isCopyingText, setIsCopyingText] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const copyImage = async () => {
    setMessage(null)
    const ClipboardItemConstructor = globalThis.ClipboardItem
    const supportsPng = ClipboardItemConstructor
      && (typeof ClipboardItemConstructor.supports !== 'function' || ClipboardItemConstructor.supports('image/png'))

    if (
      !navigator.clipboard
      || typeof navigator.clipboard.write !== 'function'
      || !ClipboardItemConstructor
      || !supportsPng
    ) {
      setMessage('このブラウザでは画像コピーを利用できません。PNG保存をご利用ください。')
      return
    }

    setIsCopyingImage(true)
    try {
      const blob = await createShareImageBlob(result, evaluations)
      await navigator.clipboard.write([
        new ClipboardItemConstructor({ 'image/png': blob }),
      ])
      setMessage('結果画像をコピーしました。')
    } catch {
      setMessage('このブラウザでは画像コピーを利用できません。PNG保存をご利用ください。')
    } finally {
      setIsCopyingImage(false)
    }
  }

  const downloadImage = async () => {
    setIsDownloading(true)
    setMessage(null)
    try {
      const blob = await createShareImageBlob(result, evaluations)
      downloadBlob(blob, createShareFilename(result.measuredAt))
      setMessage('PNG画像を保存しました。')
    } catch {
      setMessage('画像を生成できませんでした。時間を置いてもう一度お試しください。')
    } finally {
      setIsDownloading(false)
    }
  }

  const copyPostText = async () => {
    setMessage(null)
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      setMessage('投稿文をコピーできませんでした。')
      return
    }

    setIsCopyingText(true)
    try {
      await navigator.clipboard.writeText(createSharePostText(result, window.location.href))
      setMessage('投稿文をコピーしました。')
    } catch {
      setMessage('投稿文をコピーできませんでした。')
    } finally {
      setIsCopyingText(false)
    }
  }

  const postToX = () => {
    setMessage(null)
    const postText = createSharePostText(result, window.location.href)
    window.open(createXIntentUrl(postText), '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="share-result" aria-labelledby="share-title">
      <div className="share-result__heading">
        <span className="result-panel__eyebrow">SHARE</span>
        <h3 id="share-title">測定結果をシェア</h3>
        <p>1200×630pxのPNGをブラウザ内で生成します。個人情報は含みません。</p>
      </div>
      <div className="share-result__actions">
        <button className="share-button share-button--primary" type="button" onClick={copyImage} disabled={isCopyingImage}>
          {isCopyingImage ? '画像を生成中…' : '画像をコピー'}
        </button>
        <button className="share-button" type="button" onClick={downloadImage} disabled={isDownloading}>
          {isDownloading ? '画像を生成中…' : 'PNGを保存'}
        </button>
        <button className="share-button" type="button" onClick={postToX}>
          Xに投稿
        </button>
        <button className="share-button" type="button" onClick={copyPostText} disabled={isCopyingText}>
          {isCopyingText ? '投稿文をコピー中…' : '投稿文をコピー'}
        </button>
      </div>
      {message && <p className="share-result__status" role="status">{message}</p>}
    </section>
  )
}
