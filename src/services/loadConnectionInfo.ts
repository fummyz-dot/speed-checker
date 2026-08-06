import type { ConnectionInfo } from '../types/connectionInfo'

const fields = [
  'provider',
  'asn',
  'country',
  'region',
  'city',
  'cloudflareColo',
  'protocol',
] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const parseConnectionInfo = (value: unknown): ConnectionInfo => {
  if (!isRecord(value)) throw new Error('接続情報の形式が正しくありません。')

  for (const field of fields) {
    if (!(field in value)) throw new Error('接続情報の形式が正しくありません。')
  }

  if (value.asn !== null && (typeof value.asn !== 'number' || !Number.isFinite(value.asn))) {
    throw new Error('接続情報の形式が正しくありません。')
  }

  for (const field of fields.filter((field) => field !== 'asn')) {
    if (value[field] !== null && typeof value[field] !== 'string') {
      throw new Error('接続情報の形式が正しくありません。')
    }
  }

  return {
    provider: value.provider as string | null,
    asn: value.asn as number | null,
    country: value.country as string | null,
    region: value.region as string | null,
    city: value.city as string | null,
    cloudflareColo: value.cloudflareColo as string | null,
    protocol: value.protocol as string | null,
  }
}

interface LoadConnectionInfoOptions {
  signal?: AbortSignal
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export const loadConnectionInfo = async ({
  signal,
  timeoutMs = 8_000,
  fetchImpl = fetch,
}: LoadConnectionInfoOptions = {}): Promise<ConnectionInfo> => {
  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) abort()

  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetchImpl('/api/connection', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) {
      if (response.status === 404) throw new Error('接続情報は現在利用できません。')
      throw new Error(`接続情報を取得できませんでした（${response.status}）。`)
    }
    return parseConnectionInfo(await response.json())
  } catch (error) {
    if (timedOut) throw new Error('接続情報の取得がタイムアウトしました。')
    throw error
  } finally {
    globalThis.clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abort)
  }
}
