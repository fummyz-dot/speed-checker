import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const publisherAccount = 'ca-pub-5855837460728105'
const adsTxtRecord = 'google.com, pub-5855837460728105, DIRECT, f08c47fec0942fa0\n'
const accountMetaName = ['google', 'adsense', 'account'].join('-')
const prohibitedScriptDomain = ['pagead2', 'googlesyndication', 'com'].join('.')
const prohibitedAdsGlobal = ['ads', 'bygoogle'].join('')
const prohibitedAdsClient = ['google', 'ad', 'client'].join('_')

const readProjectFile = (...paths: string[]): string =>
  readFileSync(resolve(...paths), 'utf8')

const publicHtml = (): string => {
  const staticPagePaths = readdirSync(resolve('public'), { recursive: true })
    .filter((path): path is string => typeof path === 'string' && path.endsWith('index.html'))

  return [
    readProjectFile('index.html'),
    ...staticPagePaths.map((path) => readProjectFile('public', path)),
  ].join('\n')
}

describe('AdSense site verification preparation', () => {
  it('root index.htmlにPublisher Account metaを1件だけ含む', () => {
    const page = new DOMParser().parseFromString(readProjectFile('index.html'), 'text/html')
    const accountMetas = page.querySelectorAll(`meta[name="${accountMetaName}"]`)

    expect(accountMetas).toHaveLength(1)
    expect(accountMetas[0].getAttribute('content')).toBe(publisherAccount)
  })

  it('ads.txtに指定された広告販売者レコードを1行だけ含む', () => {
    expect(readProjectFile('public', 'ads.txt')).toBe(adsTxtRecord)
  })

  it('公開HTMLに広告配信のJavaScriptまたはクライアント設定を含まない', () => {
    const html = publicHtml()

    expect(html).not.toContain(prohibitedScriptDomain)
    expect(html).not.toContain(prohibitedAdsGlobal)
    expect(html).not.toContain(prohibitedAdsClient)
  })

  it('既存CSPは広告配信の許可を追加せずに維持する', () => {
    const headers = readProjectFile('public', '_headers')
    const csp = headers.split('\n')
      .find((line) => line.trimStart().startsWith('Content-Security-Policy:'))
      ?.trim()

    expect(csp).toBe("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://speed.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none';")
  })
})
