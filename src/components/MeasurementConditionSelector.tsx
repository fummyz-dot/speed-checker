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
          <span className="measurement-condition__eyebrow">MEASUREMENT</span>
          <h2 id="measurement-condition-title">測定条件</h2>
          <p>{value ?? '未設定'}</p>
        </div>
        <button
          type="button"
          className="measurement-condition__edit-button"
          onClick={openEditor}
          disabled={disabled}
          aria-expanded={isEditing}
          aria-controls="measurement-condition-editor"
        >
          {value ? '変更' : '設定'}
        </button>
      </div>

      {isEditing && (
        <div className="measurement-condition__editor" id="measurement-condition-editor">
          <label htmlFor="measurement-condition-input">条件名</label>
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
            placeholder="例：リビング 5GHz"
            aria-invalid={isDraftInvalid}
            aria-describedby={isDraftInvalid ? validationMessageId : undefined}
          />
          <p className="measurement-condition__hint">場所や接続方法などを自由に設定できます（24文字以内）</p>
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
                設定しない
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
