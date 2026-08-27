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
  { path: 'wifi-slow', canonical: 'https://netspeedrace.com/wifi-slow/' },
  { path: 'gaming', canonical: 'https://netspeedrace.com/gaming/' },
  { path: 'video-call', canonical: 'https://netspeedrace.com/video-call/' },
  { path: 'internet-slow-at-night', canonical: 'https://netspeedrace.com/internet-slow-at-night/' },
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

  it('ガイドハブで困りごと別と指標別の4記事ずつを分けて案内する', () => {
    const page = parsePage('guide')
    const cardGrids = page.querySelectorAll('.site-pages__card-grid')
    const problemDestinations = [...cardGrids[0].querySelectorAll('.site-pages__card')]
      .map((link) => link.getAttribute('href'))
    const metricDestinations = [...cardGrids[1].querySelectorAll('.site-pages__card')]
      .map((link) => link.getAttribute('href'))

    expect(page.body.textContent).toContain('困りごとから探す')
    expect(page.body.textContent).toContain('指標から探す')
    expect(problemDestinations).toEqual(['/wifi-slow/', '/gaming/', '/video-call/', '/internet-slow-at-night/'])
    expect(metricDestinations).toEqual(['/internet-speed/', '/ping/', '/jitter/', '/loaded-latency/'])
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

  it('オンラインゲーム記事に現行の参考判定と適用範囲を明記する', () => {
    const content = parsePage('gaming').body.textContent ?? ''

    expect(content).toContain('5 Mbps以上')
    expect(content).toContain('1 Mbps以上')
    expect(content).toContain('50 ms以下')
    expect(content).toContain('3 Mbps以上')
    expect(content).toContain('100 ms以下')
    expect(content).toContain('Net Speed Race内の参考判定')
    expect(content).toContain('ゲーム業界の公式基準ではありません')
    expect(content).toContain('Cloudflare側への測定')
  })

  it('Web会議記事に現行の参考判定と公式要件との差を明記する', () => {
    const content = parsePage('video-call').body.textContent ?? ''

    expect(content).toContain('10 Mbps以上')
    expect(content).toContain('5 Mbps以上')
    expect(content).toContain('80 ms以下')
    expect(content).toContain('3 Mbps以上')
    expect(content).toContain('150 ms以下')
    expect(content).toContain('Net Speed Race内の参考判定')
    expect(content).toContain('公式要件そのものではありません')
  })

  it('夜間記事に実装と一致する時間帯・中央値・ローカル履歴の説明を含む', () => {
    const content = parsePage('internet-slow-at-night').body.textContent ?? ''

    expect(content).toContain('05:00–10:59')
    expect(content).toContain('11:00–16:59')
    expect(content).toContain('17:00–22:59')
    expect(content).toContain('23:00–04:59')
    expect(content).toContain('中央値')
    expect(content).toContain('ブラウザに保存された履歴')
    expect(content).toContain('1〜2件の測定は参考値、3件以上で傾向')
  })

  it('Wi-Fi記事に利用者入力の測定条件ラベルと条件別中央値を説明する', () => {
    const content = parsePage('wifi-slow').body.textContent ?? ''

    expect(content).toContain('測定条件ラベル')
    expect(content).toContain('利用者自身が入力するメモ')
    expect(content).toContain('自動判定する機能ではありません')
    expect(content).toContain('同じ条件のDownload、Upload、Ping、混雑時の応答性の中央値')
  })

  it.each([
    'wifi-slow',
    'gaming',
    'video-call',
    'internet-slow-at-night',
  ] as const)('%s記事は原因を断定せず、絶対的な改善を約束しない', (path) => {
    const content = parsePage(path).body.textContent ?? ''

    expect(content).toMatch(/(原因|理由|問題).{0,32}(特定|確定|断定|決めつけ).{0,24}(できません|限りません)/)
    if (content.includes('必ず') || content.includes('絶対')) {
      expect(content).toMatch(/(必ず|絶対).{0,48}(とは限りません|できません)/)
    }
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

  it('静的ページに外部scriptを含めず、sitemapに15個の重複しない公開URLを含む', () => {
    staticPages.forEach(({ path }) => {
      expect(parsePage(path).querySelectorAll('script')).toHaveLength(0)
    })
    const sitemap = readPublicFile('sitemap.xml')
    const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, url]) => url)

    expect(urls).toEqual([
      'https://netspeedrace.com/',
      ...staticPages.map(({ canonical }) => canonical),
    ])
    expect(new Set(urls).size).toBe(15)
  })
})
