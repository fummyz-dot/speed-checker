import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useConnectionInfo } from '../hooks/useConnectionInfo'
import { ConnectionInfo } from './ConnectionInfo'

vi.mock('../hooks/useConnectionInfo')
const mockedHook = vi.mocked(useConnectionInfo)
const retry = vi.fn()

describe('ConnectionInfo', () => {
  beforeEach(() => retry.mockReset())

  it('loading表示を読み上げ可能にする', () => {
    mockedHook.mockReturnValue({ state: { status: 'loading' }, retry })
    render(<ConnectionInfo />)
    expect(screen.getByRole('status')).toHaveTextContent('確認しています')
  })

  it('providerとASNを表示し、IPアドレスを表示しない', () => {
    mockedHook.mockReturnValue({
      state: {
        status: 'success',
        data: {
          provider: 'Example Network', asn: 12345, country: 'JP', region: 'Tokyo',
          city: 'Tokyo', cloudflareColo: 'NRT', protocol: 'HTTP/3',
        },
      },
      retry,
    })
    const { container } = render(<ConnectionInfo />)
    expect(screen.getByText('Example Network')).toBeInTheDocument()
    expect(screen.getByText('AS12345')).toBeInTheDocument()
    expect(container).not.toHaveTextContent(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)
  })

  it('errorを表示して再取得できる', async () => {
    mockedHook.mockReturnValue({ state: { status: 'error', message: '取得失敗' }, retry })
    render(<ConnectionInfo />)
    expect(screen.getByRole('alert')).toHaveTextContent('速度測定は引き続き利用できます')
    await userEvent.click(screen.getByRole('button', { name: '再取得' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
