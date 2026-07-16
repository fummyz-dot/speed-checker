import { useCallback, useEffect, useState } from 'react'
import { loadConnectionInfo } from '../services/loadConnectionInfo'
import type { ConnectionInfoState } from '../types/connectionInfo'

export interface UseConnectionInfoResult {
  state: ConnectionInfoState
  retry: () => void
}

const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message
    ? error.message
    : '接続情報を取得できませんでした。'

export const useConnectionInfo = (): UseConnectionInfoResult => {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<ConnectionInfoState>({ status: 'loading' })
  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    let mounted = true
    setState({ status: 'loading' })

    void loadConnectionInfo({ signal: controller.signal })
      .then((data) => {
        if (mounted) setState({ status: 'success', data })
      })
      .catch((error: unknown) => {
        if (mounted && !controller.signal.aborted) {
          setState({ status: 'error', message: errorMessage(error) })
        }
      })

    return () => {
      mounted = false
      controller.abort()
    }
  }, [attempt])

  return { state, retry }
}
