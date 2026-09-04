const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const TURNSTILE_SITE_KEY = '0x4AAAAAAEm_GmFrhNWCDVom'

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string
  execute(widgetId: string): void
  remove(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let turnstileScriptPromise: Promise<TurnstileApi> | null = null

const loadTurnstile = (): Promise<TurnstileApi> => {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (turnstileScriptPromise) return turnstileScriptPromise

  turnstileScriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    const failToLoad = () => {
      script.remove()
      reject(new Error('Turnstile failed to load'))
    }
    script.src = TURNSTILE_SCRIPT_URL
    script.async = true
    script.onload = () => {
      if (window.turnstile) {
        resolve(window.turnstile)
      } else {
        failToLoad()
      }
    }
    script.onerror = failToLoad
    document.head.append(script)
  }).catch((error: unknown) => {
    turnstileScriptPromise = null
    throw error
  })

  return turnstileScriptPromise
}

export const requestRankingTurnstileToken = async (container: HTMLElement): Promise<string> => {
  const turnstile = await loadTurnstile()

  return new Promise<string>((resolve, reject) => {
    let widgetId: string | null = null
    let settled = false
    const cleanup = () => {
      if (widgetId !== null) turnstile.remove(widgetId)
    }
    const succeed = (token: unknown) => {
      if (settled) return
      if (typeof token !== 'string' || token.length === 0) {
        fail()
        return
      }
      settled = true
      cleanup()
      resolve(token)
    }
    const fail = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('Turnstile challenge failed'))
    }

    try {
      widgetId = turnstile.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        action: 'ranking_submit',
        execution: 'execute',
        appearance: 'interaction-only',
        size: 'compact',
        theme: 'auto',
        'response-field': false,
        callback: succeed,
        'error-callback': fail,
        'expired-callback': fail,
        'timeout-callback': fail,
      })
      if (settled) {
        cleanup()
        return
      }
      turnstile.execute(widgetId)
    } catch {
      fail()
    }
  })
}
