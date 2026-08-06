import { describe, expect, it, vi } from 'vitest'
import { loadConnectionInfo, parseConnectionInfo } from './loadConnectionInfo'

const validInfo = {
  provider: 'Example Network',
  asn: 12345,
  country: 'JP',
  region: 'Tokyo',
  city: 'Tokyo',
  cloudflareColo: 'NRT',
  protocol: 'HTTP/3',
}

describe('parseConnectionInfo', () => {
  it('正常なJSONを解析する', () => {
    expect(parseConnectionInfo(validInfo)).toEqual(validInfo)
  })

  it('全項目のnullを許容する', () => {
    const nullInfo = Object.fromEntries(Object.keys(validInfo).map((key) => [key, null]))
    expect(parseConnectionInfo(nullInfo)).toEqual(nullInfo)
  })

  it('不正なJSONを拒否する', () => {
    expect(() => parseConnectionInfo({ ...validInfo, asn: '12345' })).toThrow(
      '接続情報の形式が正しくありません。',
    )
    expect(() => parseConnectionInfo({ provider: 'incomplete' })).toThrow()
  })
})

describe('loadConnectionInfo', () => {
  it('404を利用者向けメッセージへ変換する', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 404 }))
    const error = await loadConnectionInfo({ fetchImpl }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe('接続情報は現在利用できません。')
    expect((error as Error).message).not.toContain('404')
  })

  it('HTTPエラーを処理する', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 503 }))
    await expect(loadConnectionInfo({ fetchImpl })).rejects.toThrow('503')
  })

  it('タイムアウトで中断する', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      }),
    ) as unknown as typeof fetch
    const promise = loadConnectionInfo({ fetchImpl, timeoutMs: 100 })
    const expectation = expect(promise).rejects.toThrow('タイムアウト')
    await vi.advanceTimersByTimeAsync(100)
    await expectation
    vi.useRealTimers()
  })

  it('呼び出し側のAbortControllerを伝播する', async () => {
    const controller = new AbortController()
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      }),
    ) as unknown as typeof fetch
    const promise = loadConnectionInfo({ fetchImpl, signal: controller.signal })
    controller.abort()
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })
})
