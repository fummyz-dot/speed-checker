import { useEffect, useState } from 'react'
import { loadMeasurements, getRecentConditionLabels } from '../lib/measurementStorage'
import { normalizeConditionLabel } from '../lib/measurementValidation'

interface MeasurementConditionSelectorProps {
  value: string | null
  disabled: boolean
  onChange: (value: string | null) => void
  onEditingChange?: (editing: boolean) => void
}

export const MeasurementConditionSelector = ({
  value,
  disabled,
  onChange,
  onEditingChange,
}: MeasurementConditionSelectorProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [recentLabels, setRecentLabels] = useState<string[]>([])
  const normalizedDraft = normalizeConditionLabel(draft)
  const isDraftEmpty = draft.trim().length === 0
  const isDraftInvalid = !isDraftEmpty && normalizedDraft === null
  const validationMessageId = 'measurement-condition-validation'
  const hintId = 'measurement-condition-hint'

  const closeEditor = () => {
    setIsEditing(false)
    onEditingChange?.(false)
  }

  const openEditor = () => {
    setDraft(value ?? '')
    setRecentLabels(getRecentConditionLabels(loadMeasurements()))
    setIsEditing(true)
    onEditingChange?.(true)
  }

  const applyDraft = () => {
    if (isDraftInvalid) return
    onChange(normalizedDraft)
    closeEditor()
  }

  useEffect(() => {
    if (disabled && isEditing) closeEditor()
  }, [disabled, isEditing])

  return (
    <section className="measurement-condition" aria-labelledby="measurement-condition-title">
      <div className="measurement-condition__summary">
        <div className="measurement-condition__summary-copy">
          <h2 id="measurement-condition-title">比較条件（任意）</h2>
          <p>{value ?? '未入力'}</p>
        </div>
        <button
          id="measurement-condition-edit"
          type="button"
          className="measurement-condition__edit-button"
          onClick={openEditor}
          disabled={disabled}
          aria-expanded={isEditing}
          aria-controls="measurement-condition-editor"
        >
          {value ? '変更' : '入力'}
        </button>
      </div>
      <p className="measurement-condition__description">
        Wi-Fi／有線、部屋、時間帯などをメモして測定を重ねると、条件別の中央値を比較できます。
      </p>

      {isEditing && (
        <div className="measurement-condition__editor" id="measurement-condition-editor">
          <label htmlFor="measurement-condition-input">比較条件のメモ</label>
          <input
            id="measurement-condition-input"
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              applyDraft()
            }}
            placeholder="例：Wi-Fi・リビング・夜"
            aria-invalid={isDraftInvalid}
            aria-describedby={isDraftInvalid ? `${hintId} ${validationMessageId}` : hintId}
          />
          <p className="measurement-condition__hint" id={hintId}>入力した内容は比較用メモとして保存されます（24文字以内）。</p>
          {isDraftInvalid && (
            <p className="measurement-condition__validation" id={validationMessageId} role="alert">
              24文字以内で入力してください
            </p>
          )}

          {recentLabels.length > 0 && (
            <div className="measurement-condition__recent">
              <h3>最近使った条件</h3>
              <div className="measurement-condition__chips">
                {recentLabels.map((label) => (
                  <button
                    type="button"
                    key={label}
                    onClick={() => {
                      onChange(label)
                      closeEditor()
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="measurement-condition__actions">
            {value !== null && (
              <button
                type="button"
                className="measurement-condition__unset-button"
                onClick={() => {
                  onChange(null)
                  closeEditor()
                }}
              >
                条件を外す
              </button>
            )}
            <div className="measurement-condition__primary-actions">
              <button type="button" onClick={closeEditor}>キャンセル</button>
              <button type="button" onClick={applyDraft} disabled={isDraftInvalid}>
                この条件を使う
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
