import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MEASUREMENT_STORAGE_KEY } from '../lib/measurementStorage'
import type { SpeedMeasurementResult } from '../types/measurement'
import { MeasurementConditionSelector } from './MeasurementConditionSelector'

const measurement = (id: string, conditionLabel?: string | null): SpeedMeasurementResult => ({
  id,
  measuredAt: `2026-08-20T00:00:0${id}.000Z`,
  downloadMbps: 100,
  uploadMbps: 50,
  pingMs: 10,
  ...(conditionLabel === undefined ? {} : { conditionLabel }),
})

describe('MeasurementConditionSelector', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('未設定状態からinline editorを開く', async () => {
    const user = userEvent.setup()
    render(<MeasurementConditionSelector value={null} disabled={false} onChange={vi.fn()} />)

    expect(screen.getByText('未設定')).toBeVisible()
    await user.click(screen.getByRole('button', { name: '設定' }))

    expect(screen.getByRole('textbox', { name: '条件名' })).toHaveValue('')
    expect(screen.getByText('場所や接続方法などを自由に設定できます（24文字以内）')).toBeVisible()
  })

  it('設定済みラベルをdraftへ入れ、trimして適用する', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MeasurementConditionSelector value="寝室 5GHz" disabled={false} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '変更' }))
    const input = screen.getByRole('textbox', { name: '条件名' })
    expect(input).toHaveValue('寝室 5GHz')
    await user.clear(input)
    await user.type(input, '  リビング 5GHz  ')
    await user.click(screen.getByRole('button', { name: 'この条件を使う' }))

    expect(onChange).toHaveBeenCalledWith('リビング 5GHz')
    expect(screen.queryByRole('textbox', { name: '条件名' })).not.toBeInTheDocument()
  })

  it.each(['', '     '])('空入力（%j）を未設定として適用する', async (label) => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MeasurementConditionSelector value="有線LAN" disabled={false} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '変更' }))
    const input = screen.getByRole('textbox', { name: '条件名' })
    await user.clear(input)
    if (label) await user.type(input, label)
    await user.click(screen.getByRole('button', { name: 'この条件を使う' }))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('25文字以上は切り詰めず、validation表示と適用禁止にする', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MeasurementConditionSelector value="有線LAN" disabled={false} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '変更' }))
    const input = screen.getByRole('textbox', { name: '条件名' })
    const tooLong = 'あ'.repeat(25)
    await user.clear(input)
    await user.type(input, tooLong)

    expect(input).toHaveValue(tooLong)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('24文字以内で入力してください')
    expect(screen.getByRole('button', { name: 'この条件を使う' })).toBeDisabled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('24文字は有効で、Enterでも適用できる', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const label = 'あ'.repeat(24)
    render(<MeasurementConditionSelector value={null} disabled={false} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '設定' }))
    const input = screen.getByRole('textbox', { name: '条件名' })
    await user.type(input, label)
    await user.keyboard('{Enter}')

    expect(onChange).toHaveBeenCalledWith(label)
    expect(screen.queryByRole('textbox', { name: '条件名' })).not.toBeInTheDocument()
  })

  it('キャンセルは選択済みconditionを変更せず、設定しないは明示的に解除する', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MeasurementConditionSelector value="有線LAN" disabled={false} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '変更' }))
    await user.clear(screen.getByRole('textbox', { name: '条件名' }))
    await user.type(screen.getByRole('textbox', { name: '条件名' }), '寝室 5GHz')
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(onChange).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '変更' }))
    await user.click(screen.getByRole('button', { name: '設定しない' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('LocalStorage履歴からrecentを最新順で表示し、ワンタップで選択して閉じる', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    window.localStorage.setItem(MEASUREMENT_STORAGE_KEY, JSON.stringify([
      measurement('1', 'リビング 5GHz'),
      measurement('2', '有線LAN'),
      measurement('3', 'リビング 5GHz'),
      measurement('4'),
      measurement('5', '寝室 5GHz'),
    ]))
    render(<MeasurementConditionSelector value={null} disabled={false} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '設定' }))
    expect(screen.getByRole('heading', { name: '最近使った条件' })).toBeVisible()
    const chips = screen.getAllByRole('button').filter((button) => (
      ['リビング 5GHz', '有線LAN', '寝室 5GHz'].includes(button.textContent ?? '')
    ))
    expect(chips.map((chip) => chip.textContent)).toEqual(['リビング 5GHz', '有線LAN', '寝室 5GHz'])

    await user.click(screen.getByRole('button', { name: '有線LAN' }))
    expect(onChange).toHaveBeenCalledWith('有線LAN')
    expect(screen.queryByRole('textbox', { name: '条件名' })).not.toBeInTheDocument()
  })

  it('disabled時はeditorを開けない', async () => {
    const user = userEvent.setup()
    render(<MeasurementConditionSelector value="有線LAN" disabled onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: '変更' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '変更' }))
    expect(screen.queryByRole('textbox', { name: '条件名' })).not.toBeInTheDocument()
  })
})
