import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const staticPages = [
  { path: 'about', canonical: 'https://netspeedrace.com/about/' },
  { path: 'methodology', canonical: 'https://netspeedrace.com/methodology/' },
  { path: 'privacy', canonical: 'https://netspeedrace.com/privacy/' },
  { path: 'contact', canonical: 'https://netspeedrace.com/contact/' },
  { path: 'terms', canonical: 'https://netspeedrace.com/terms/' },
] as const

const readPublicFile = (path: string): string =>
  readFileSync(resolve('public', path), 'utf8')

const parsePage = (path: string): Document =>
  new DOMParser().parseFromString(readPublicFile(`${path}/index.html`), 'text/html')

describe('public trust pages', () => {
  it.each(staticPages)('$pathページに1件のh1、固有canonical、titleを含む', ({ path, canonical }) => {
    const page = parsePage(path)

    expect(page.documentElement.lang).toBe('ja')
    expect(page.querySelectorAll('h1')).toHaveLength(1)
    expect(page.title).not.toBe('')
    expect(page.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(canonical)
    expect(page.querySelectorAll('header nav a')).toHaveLength(6)
    expect(page.querySelectorAll('footer nav a')).toHaveLength(6)
  })

  it('お問い合わせページに公開問い合わせ先を含む', () => {
    const page = parsePage('contact')

    expect(page.body.textContent).toContain('contact@netspeedrace.com')
    expect(page.querySelector('a[href="mailto:contact@netspeedrace.com"]')).not.toBeNull()
  })

  it('プライバシーページに実装と一致するデータ取扱いを含む', () => {
    const page = parsePage('privacy')
    const content = page.body.textContent ?? ''

    expect(content).toContain('LocalStorage')
    expect(content).toContain('Cloudflare')
    expect(content).toContain('IPアドレス')
    expect(content).toContain('広告配信を導入していません')
  })

  it('測定方法ページにCloudflare、Ping、Jitter、loaded latencyの説明を含む', () => {
    const content = parsePage('methodology').body.textContent ?? ''

    expect(content).toContain('Cloudflare')
    expect(content).toContain('Ping')
    expect(content).toContain('Jitter')
    expect(content).toContain('loaded latency')
  })

  it('sitemapに6つの重複しない公開URLを含む', () => {
    const sitemap = readPublicFile('sitemap.xml')
    const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, url]) => url)

    expect(urls).toEqual([
      'https://netspeedrace.com/',
      ...staticPages.map(({ canonical }) => canonical),
    ])
    expect(new Set(urls).size).toBe(6)
  })
})
