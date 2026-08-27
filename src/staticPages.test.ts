import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const trustPages = [
  { path: 'about', canonical: 'https://netspeedrace.com/about/' },
  { path: 'methodology', canonical: 'https://netspeedrace.com/methodology/' },
  { path: 'privacy', canonical: 'https://netspeedrace.com/privacy/' },
  { path: 'contact', canonical: 'https://netspeedrace.com/contact/' },
  { path: 'terms', canonical: 'https://netspeedrace.com/terms/' },
] as const

const guidePages = [
  { path: 'guide', canonical: 'https://netspeedrace.com/guide/' },
  { path: 'internet-speed', canonical: 'https://netspeedrace.com/internet-speed/' },
  { path: 'ping', canonical: 'https://netspeedrace.com/ping/' },
  { path: 'jitter', canonical: 'https://netspeedrace.com/jitter/' },
  { path: 'loaded-latency', canonical: 'https://netspeedrace.com/loaded-latency/' },
] as const

const staticPages = [...trustPages, ...guidePages]

const readPublicFile = (path: string): string =>
  readFileSync(resolve('public', path), 'utf8')

const parsePage = (path: string): Document =>
  new DOMParser().parseFromString(readPublicFile(`${path}/index.html`), 'text/html')

describe('public static pages', () => {
  it.each(staticPages)('$pathページに1件のh1、固有canonical、titleを含む', ({ path, canonical }) => {
    const page = parsePage(path)

    expect(page.documentElement.lang).toBe('ja')
    expect(page.querySelectorAll('h1')).toHaveLength(1)
    expect(page.title).not.toBe('')
    expect(page.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(canonical)
    expect(page.querySelectorAll('header nav a')).toHaveLength(7)
    expect(page.querySelectorAll('footer nav a')).toHaveLength(7)
  })

  it('ガイドページごとに固有のtitle、description、OGPを持つ', () => {
    const titles = guidePages.map(({ path }) => parsePage(path).title)

    expect(new Set(titles).size).toBe(guidePages.length)
    guidePages.forEach(({ path, canonical }) => {
      const page = parsePage(path)
      expect(page.querySelector('meta[name="description"]')?.getAttribute('content')).not.toBe('')
      expect(page.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(page.title)
      expect(page.querySelector('meta[property="og:description"]')?.getAttribute('content')).not.toBe('')
      expect(page.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(canonical)
      expect(page.querySelector('meta[property="og:site_name"]')?.getAttribute('content')).toBe('Net Speed Race')
    })
  })

  it.each(guidePages)('$pathガイドに測定CTAと信頼性リンクを含む', ({ path }) => {
    const page = parsePage(path)

    expect(page.querySelectorAll('a.site-pages__article-cta[href="/"]')).toHaveLength(2)
    expect(page.querySelector('a[href="/methodology/"]')).not.toBeNull()
    expect(page.querySelector('a[href="/about/"]')).not.toBeNull()
  })

  it('ガイドハブから4つの詳細記事へ進める', () => {
    const page = parsePage('guide')
    const destinations = [...page.querySelectorAll('.site-pages__card')].map((link) => link.getAttribute('href'))

    expect(destinations).toEqual(['/internet-speed/', '/ping/', '/jitter/', '/loaded-latency/'])
  })

  it.each(guidePages.filter(({ path }) => path !== 'guide'))('$path記事に関連ガイドリンクを含む', ({ path }) => {
    expect(parsePage(path).querySelectorAll('.site-pages__related a')).toHaveLength(4)
  })

  it('Loaded Latencyページに現行の表示基準と公式標準ではない旨を含む', () => {
    const content = parsePage('loaded-latency').body.textContent ?? ''

    expect(content).toContain('0〜20ms')
    expect(content).toContain('20ms超〜100ms')
    expect(content).toContain('100ms超')
    expect(content).toContain('公式標準ではありません')
  })

  it('PingとJitterの各ページに区別の説明を含む', () => {
    expect(parsePage('ping').body.textContent).toContain('Cloudflare Edge RTT')
    expect(parsePage('jitter').body.textContent).toContain('Pingとの違い')
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

  it('静的ページに外部scriptを含めず、sitemapに11個の重複しない公開URLを含む', () => {
    staticPages.forEach(({ path }) => {
      expect(parsePage(path).querySelectorAll('script')).toHaveLength(0)
    })
    const sitemap = readPublicFile('sitemap.xml')
    const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, url]) => url)

    expect(urls).toEqual([
      'https://netspeedrace.com/',
      ...staticPages.map(({ canonical }) => canonical),
    ])
    expect(new Set(urls).size).toBe(11)
  })
})
