import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface TurnstileMock {
  render: ReturnType<typeof vi.fn>
  execute: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

let requestRankingTurnstileToken: typeof import('./turnstile').requestRankingTurnstileToken

beforeEach(async () => {
  vi.resetModules()
  document.head.querySelectorAll('script[src*="challenges.cloudflare.com"]').forEach((script) => script.remove())
  delete window.turnstile
  ;({ requestRankingTurnstileToken } = await import('./turnstile'))
})

afterEach(() => {
  delete window.turnstile
})

const createTurnstile = (): TurnstileMock => ({
  render: vi.fn(() => 'widget-id'),
  execute: vi.fn(),
  remove: vi.fn(),
})

describe('requestRankingTurnstileToken', () => {
  it('loads the explicit script only on request and executes the managed widget once', async () => {
    expect(document.head.querySelector('script[src*="challenges.cloudflare.com"]')).toBeNull()
    const container = document.createElement('div')
    const challenge = createTurnstile()
    let options: Record<string, unknown> | undefined
    challenge.render.mockImplementation((_container: HTMLElement, nextOptions: Record<string, unknown>) => {
      options = nextOptions
      return 'widget-id'
    })

    const token = requestRankingTurnstileToken(container)
    const script = document.head.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com"]')
    expect(script?.src).toContain('/turnstile/v0/api.js?render=explicit')
    Object.assign(window, { turnstile: challenge })
    script?.dispatchEvent(new Event('load'))
    await vi.waitFor(() => expect(options).toBeDefined())
    ;(options?.callback as (token: string) => void)('token-value')

    await expect(token).resolves.toBe('token-value')
    expect(options).toMatchObject({
      sitekey: '0x4AAAAAAEm_GmFrhNWCDVom',
      action: 'ranking_submit',
      execution: 'execute',
      appearance: 'interaction-only',
      size: 'compact',
      theme: 'auto',
      'response-field': false,
    })
    expect(challenge.execute).toHaveBeenCalledTimes(1)
    expect(challenge.execute).toHaveBeenCalledWith('widget-id')
    expect(challenge.remove).toHaveBeenCalledWith('widget-id')
  })

  it('shares a pending script load and resets it after a load failure', async () => {
    const first = requestRankingTurnstileToken(document.createElement('div'))
    const second = requestRankingTurnstileToken(document.createElement('div'))
    const firstScript = document.head.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com"]')
    expect(document.head.querySelectorAll('script[src*="challenges.cloudflare.com"]')).toHaveLength(1)
    firstScript?.dispatchEvent(new Event('error'))

    await expect(first).rejects.toThrow()
    await expect(second).rejects.toThrow()
    void requestRankingTurnstileToken(document.createElement('div')).catch(() => undefined)
    expect(document.head.querySelectorAll('script[src*="challenges.cloudflare.com"]')).toHaveLength(1)
  })

  it.each(['error-callback', 'expired-callback', 'timeout-callback'])('%s rejects and removes the widget', async (callbackName) => {
    const container = document.createElement('div')
    const challenge = createTurnstile()
    let options: Record<string, unknown> | undefined
    challenge.render.mockImplementation((_container: HTMLElement, nextOptions: Record<string, unknown>) => {
      options = nextOptions
      return 'widget-id'
    })
    Object.assign(window, { turnstile: challenge })

    const token = requestRankingTurnstileToken(container)
    await vi.waitFor(() => expect(options).toBeDefined())
    ;(options?.[callbackName] as () => void)()

    await expect(token).rejects.toThrow()
    expect(challenge.remove).toHaveBeenCalledWith('widget-id')
  })
})
