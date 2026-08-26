import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Brand } from './Brand'

describe('Brand', () => {
  it('Net Speed Raceをアクセシブルなホームリンクとして表示する', () => {
    render(<Brand />)

    expect(screen.getByRole('link', { name: 'Net Speed Race ホーム' })).toHaveAttribute('href', '/')
    expect(screen.getByText('Net Speed Race')).toBeVisible()
  })
})
