import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { evaluateLoadedLatencyResponsiveness } from './lib/loadedLatencyEvaluation'

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

const rankingPages = [
  { path: 'ranking', canonical: 'https://netspeedrace.com/ranking/' },
] as const

const labPages = [
  { path: 'lab/ping-jitter-14-runs', canonical: 'https://netspeedrace.com/lab/ping-jitter-14-runs/' },
] as const

const staticPages = [...trustPages, ...guidePages, ...rankingPages, ...labPages]

const readPublicFile = (path: string): string =>
  readFileSync(resolve('public', path), 'utf8')

const readProjectFile = (path: string): string =>
  readFileSync(resolve(path), 'utf8')

const parsePage = (path: string): Document =>
  new DOMParser().parseFromString(readPublicFile(`${path}/index.html`), 'text/html')

// Protected content fingerprints from add7746: only decorative eyebrows are excluded.
const editorialContentBaseline: Record<string, string> = {
  'about': 'b667d3a3f807496bfb7f70ba765a2b9f36cb2f5937351826008c13bfe7233236',
  'methodology': '13d7e0ba659be6f74a213c0a3906b8147e60d2b0afbce73bc8bdae04801ba7c9',
  'privacy': '12f625d826cd1806172075a17456ad979b1415bd55a540c556ef8cfd27aee755',
  'contact': 'b48a14a82c282e18a3c19023c0355ff530f8ac3e2ed13bc437e968d249e369f0',
  'terms': '8fba8db5d2d0b9b0c1b6e01a48ec680f62fae5046dd934e3bc9f5b777d8e47c2',
  'guide': '64590b2e36327d9679c8a3132c6b449195614123794f44e54853ec1306b035da',
  'internet-speed': '78120b5f461ba6f0f7f883ab5128244e871ba5432b5625f8e98a41e08447a755',
  'ping': '79bea22a949f9564a7e3ca6012a5201d3b71b6e631c435ca17d9dab4592fe1f7',
  'jitter': 'df5dc8156cfd107cd561d8f79bff35e72fd3cd8171c7d606ebdd0d53eaa7864b',
  'loaded-latency': '61aa200353b765889090fcc2beeb417ea1ac2a38b12a357d78f118c3a0c352c2',
  'wifi-slow': '4753ee1da63cb0386928e074211056ae22ff84b0783b64c01bdf7768f039c3da',
  'gaming': '971f637a431a5a4f48b8737e07fc45320d82c7d7970fbe715b169b919a66b01b',
  'video-call': '30497748bcb6ac914e2a70ae21d103adaf63e831a5fa60a67d1f7879683b92d6',
  'internet-slow-at-night': 'd14777a1bef07124bb0fe236f341ae48731cccc1c510ca1b53d5e985aaa2f3e2',
  'ranking': 'd382f85a6181cd702aea36963f70005c4fe50d7d02d4eeb110e7ce16dff81857',
  'lab/ping-jitter-14-runs': '13893aab621aaef1e1a33642f4e27cbb7724c35accc98ef4d85ff40f5d141c61',
}

// Supplied observations only; aggregate values are calculated from these rounded inputs.
const labMeasurements = [
  ['10:11:33', 436.2, 39.6, 48.9, 11.7, 56.4, 65.2],
  ['10:12:23', 541.0, 45.8, 51.5, 15.3, 62.5, 59.0],
  ['10:13:10', 458.9, 34.2, 52.6, 6.5, 109.5, 61.9],
  ['10:15:19', 543.7, 56.4, 52.7, 9.9, 102.0, 120.8],
  ['10:19:44', 567.2, 46.8, 51.7, 17.2, 65.6, 63.0],
  ['10:20:23', 587.6, 31.4, 55.4, 16.6, 62.5, 60.7],
  ['10:21:03', 571.8, 37.1, 52.0, 18.5, 62.8, 61.2],
  ['10:21:37', 552.9, 55.0, 53.8, 6.2, 100.1, 79.1],
  ['10:22:22', 497.0, 48.1, 58.1, 16.6, 64.3, 71.9],
  ['10:23:11', 505.0, 44.5, 52.4, 6.4, 141.6, 62.4],
  ['10:24:53', 509.4, 31.6, 59.2, 9.5, 53.5, 62.4],
  ['10:25:37', 612.3, 41.3, 52.7, 15.1, 56.8, 63.5],
  ['10:26:41', 500.7, 32.8, 55.0, 12.2, 65.2, 66.1],
  ['10:27:34', 568.2, 36.0, 62.1, 14.9, 62.6, 63.4],
] as const

const readLabCsv = (): string[][] =>
  readPublicFile('lab/ping-jitter-14-runs/data.csv').trim().split('\n').map((line) => line.split(','))

describe('public static pages', () => {
  it.each(staticPages)('$pathのSEO・本文・日付・全リンクをデザイン変更前から維持する', ({ path }) => {
    const page = parsePage(path)
    page.querySelectorAll('.site-pages__eyebrow').forEach((element) => element.remove())
    const protectedContent = {
      head: page.head.innerHTML.replace(/\s+/g, ' ').trim(),
      h1: page.querySelector('h1')?.textContent,
      body: page.body.textContent?.replace(/\s+/g, ' ').trim(),
      links: [...page.querySelectorAll('a')].map((link) => [
        link.getAttribute('href'), link.textContent, link.getAttribute('download'),
      ]),
    }

    expect(createHash('sha256').update(JSON.stringify(protectedContent)).digest('hex'))
      .toBe(editorialContentBaseline[path])
    expect(page.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '')
      .not.toContain('noindex')
  })

  it('robotsとsitemapをデザイン変更前から維持する', () => {
    expect(createHash('sha256').update(readPublicFile('robots.txt')).digest('hex'))
      .toBe('5a4b5cd4f572b26a0ef137dfe6561f6c15a56f4bca89a094a025fb0f8f134d8e')
    expect(createHash('sha256').update(readPublicFile('sitemap.xml')).digest('hex'))
      .toBe('419cceacca2f70726b7b23a9500b2099c5f6b9a3e4f11d47c16d73cbae3c0dc0')
  })

  it('Workers Static Assetsは未一致パスへcustom 404を返す設定を維持する', () => {
    const config = JSON.parse(readProjectFile('wrangler.jsonc')) as {
      assets?: {
        directory?: string
        binding?: string
        not_found_handling?: string
        run_worker_first?: string[]
      }
    }

    expect(config.assets).toEqual({
      directory: './dist',
      binding: 'ASSETS',
      not_found_handling: '404-page',
      run_worker_first: ['/api/*'],
    })
  })

  it('custom 404は検索対象外で主要ページへの導線を持ち、canonicalを持たない', () => {
    const page = new DOMParser().parseFromString(readPublicFile('404.html'), 'text/html')

    expect(page.documentElement.lang).toBe('ja')
    expect(page.title).toBe('ページが見つかりません | Net Speed Race')
    expect(page.querySelectorAll('h1')).toHaveLength(1)
    expect(page.querySelector('h1')?.textContent).toBe('ページが見つかりません')
    expect(page.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, follow')
    ;['/', '/guide/', '/ranking/', '/about/'].forEach((href) => {
      expect(page.querySelector(`main a[href="${href}"]`)).not.toBeNull()
    })
    expect(page.querySelector('link[rel="canonical"]')).toBeNull()
    expect(page.querySelector('#root')).toBeNull()
  })

  it('公開URLに対応する既存assetを維持する', () => {
    const publicAssets = [
      ...staticPages.map(({ path }) => `${path}/index.html`),
      'run/index.html',
      'robots.txt',
      'sitemap.xml',
      'ads.txt',
    ]

    expect(existsSync(resolve('index.html'))).toBe(true)
    publicAssets.forEach((path) => expect(existsSync(resolve('public', path)), path).toBe(true))
  })

  it('TurnstileのscriptとframeだけをCSPで許可する', () => {
    const headers = readPublicFile('_headers')

    expect(headers).toContain("script-src 'self' https://challenges.cloudflare.com")
    expect(headers).toContain('frame-src https://challenges.cloudflare.com')
    expect(headers).toContain("connect-src 'self' https://speed.cloudflare.com")
  })

  it.each(staticPages)('$pathページに1件のh1、固有canonical、titleを含む', ({ path, canonical }) => {
    const page = parsePage(path)

    expect(page.documentElement.lang).toBe('ja')
    expect(page.querySelectorAll('h1')).toHaveLength(1)
    expect(page.title).not.toBe('')
    expect(page.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(canonical)
    expect(page.querySelectorAll('header nav a')).toHaveLength(7)
    expect(page.querySelectorAll('footer nav a')).toHaveLength(8)
  })

  it.each(staticPages)('$pathページのFooterに公開ソースコードリンクを含み、Private repo名を含まない', ({ path }) => {
    const page = parsePage(path)
    const sourceLink = [...page.querySelectorAll('footer a')]
      .find((link) => link.textContent === 'GitHubでソースコードを見る')

    expect(sourceLink?.getAttribute('href')).toBe('https://github.com/fummyz-dot/speed-checker')
    expect(sourceLink?.getAttribute('target')).toBe('_blank')
    expect(sourceLink?.getAttribute('rel')).toBe('noreferrer noopener')
    expect(page.documentElement.outerHTML).not.toContain('netspeedrace-internal')
  })

  it('Aboutページに測定方法とプライバシー実装を確認できる透明性の説明を含む', () => {
    const page = parsePage('about')
    const content = page.body.textContent ?? ''

    expect(content).toContain('測定方法やプライバシーに関する実装を確認できるよう、主要なソースコードをGitHubで公開しています。')
    const sourceLink = [...page.querySelectorAll('article a')]
      .find((link) => link.textContent === 'GitHubでソースコードを見る')

    expect(sourceLink?.getAttribute('href')).toBe('https://github.com/fummyz-dot/speed-checker')
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

  it('PingページにMbpsとは別にidle latencyとJitterを読む説明用の比較例を含む', () => {
    const page = parsePage('ping')
    const example = page.getElementById('ping-example-title')?.parentElement
    const content = example?.textContent ?? ''

    ;['説明用', '520 Mbps', '505 Mbps', '9 ms', '34 ms', 'idle latency', 'Jitter', 'Loaded Latency', 'Cloudflare Edge RTT'].forEach((text) => {
      expect(content).toContain(text)
    })
    expect([...example?.querySelectorAll('tbody tr') ?? []].map((row) =>
      [...row.children].map((cell) => cell.textContent),
    )).toEqual([
      ['測定A', '520 Mbps', '110 Mbps', '9 ms', '2 ms'],
      ['測定B', '505 Mbps', '108 Mbps', '34 ms', '7 ms'],
    ])
    expect(content).toMatch(/原因.{0,16}確定することはできません/)
    expect(content).toContain('同じ場所・端末・接続方法で複数回')
  })

  it('Loaded Latencyページに計算例、clamp、現行の表示基準と公式標準ではない旨を含む', () => {
    const page = parsePage('loaded-latency')
    const content = page.body.textContent ?? ''
    const exampleContent = page.getElementById('loaded-example-title')?.parentElement?.textContent ?? ''

    expect(content).toContain('0〜20ms')
    expect(content).toContain('20ms超〜100ms')
    expect(content).toContain('100ms超')
    expect(content).toContain('公式標準ではありません')
    ;[
      '説明用', '27 - 12 = 15 ms', '91 - 12 = 79 ms', '15 ms → 良好', '79 ms → 注意',
      'max(0, -4) = 0 ms', '22 ms', '18 ms', '0 ms', '改善量 -4 ms',
      'idle Pingが低く、increaseも小さい', 'Upload increaseだけ大きい', 'Pingそのもの',
    ].forEach((text) => expect(exampleContent).toContain(text))
    expect([...page.querySelectorAll('#loaded-example-title ~ .site-pages__table-wrap tbody tr')].map((row) =>
      [...row.children].map((cell) => cell.textContent),
    )).toEqual([
      ['Download', '27 - 12 = 15 ms', '15 ms → 良好'],
      ['Upload', '91 - 12 = 79 ms', '79 ms → 注意'],
    ])
    expect(exampleContent).toMatch(/原因.{0,40}断定することはできません/)
  })

  it('PingとJitterの各ページに区別の説明を含む', () => {
    expect(parsePage('ping').body.textContent).toContain('Cloudflare Edge RTT')
    expect(parsePage('jitter').body.textContent).toContain('Pingとの違い')
  })

  it('回線速度ガイドに単位、実測比較、用途別の見方、ランキングへの導線を含む', () => {
    const page = parsePage('internet-speed')
    const content = page.body.textContent ?? ''

    ;[
      'Mbps', 'MB/s', '1 Byte', '8 bit', '12.5 MB/s', '125 MB/s', 'Download', 'Upload',
      '最大1 Gbps', '同じ条件で複数回', '最大30件', '約80秒', 'Ping', 'Jitter',
      'Loaded latency', '全国回線品質ランキング', '1出走', 'Net Speed Score',
      '統計的に代表するものではありません',
    ].forEach((text) => expect(content).toContain(text))
    ;['/ranking/', '/ping/', '/jitter/', '/loaded-latency/', '/gaming/', '/video-call/', '/methodology/', '/about/'].forEach((href) => {
      expect(page.querySelector(`a[href="${href}"]`)).not.toBeNull()
    })
    ;['D^0.7', 'U^0.3', 'Sref', 'Fs', 'Fp', 'Fj', 'netspeedrace-internal'].forEach((text) => {
      expect(content).not.toContain(text)
    })
    expect(page.querySelectorAll('.site-pages__related a')).toHaveLength(4)
    expect(page.querySelectorAll('script')).toHaveLength(0)
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
    const page = parsePage('internet-slow-at-night')
    const content = page.body.textContent ?? ''
    const exampleContent = page.getElementById('night-example-title')?.parentElement?.textContent ?? ''

    expect(content).toContain('05:00–10:59')
    expect(content).toContain('11:00–16:59')
    expect(content).toContain('17:00–22:59')
    expect(content).toContain('23:00–04:59')
    expect(content).toContain('中央値')
    expect(content).toContain('ブラウザに保存された履歴')
    expect(content).toContain('1〜2件の測定は参考値、3件以上で傾向')
    ;[
      '説明用データ', 'リビング 5GHz', '朝の測定3件と中央値', '夜の測定3件と中央値',
      '510 Mbps', '110 Mbps', '10 ms', '+20 ms', '205 Mbps', '70 Mbps', '29 ms', '+85 ms',
      '夜という時間帯と結果の変化が一緒に現れた', 'ISPの混雑', 'Wi-Fi', '建物設備', '夜なら必ず遅い',
    ].forEach((text) => expect(exampleContent).toContain(text))
    expect([...page.querySelectorAll('#night-example-title ~ .site-pages__table-wrap tbody')].map((body) =>
      [...body.querySelectorAll('tr')].map((row) => [...row.children].map((cell) => cell.textContent)),
    )).toEqual([
      [
        ['測定1', '510 Mbps', '110 Mbps', '10 ms', '+18 ms'],
        ['測定2', '530 Mbps', '108 Mbps', '9 ms', '+20 ms'],
        ['測定3', '500 Mbps', '115 Mbps', '11 ms', '+22 ms'],
        ['中央値', '510 Mbps', '110 Mbps', '10 ms', '+20 ms'],
      ],
      [
        ['測定1', '210 Mbps', '72 Mbps', '29 ms', '+85 ms'],
        ['測定2', '190 Mbps', '68 Mbps', '31 ms', '+78 ms'],
        ['測定3', '205 Mbps', '70 Mbps', '28 ms', '+90 ms'],
        ['中央値', '205 Mbps', '70 Mbps', '29 ms', '+85 ms'],
      ],
    ])
    expect(exampleContent).toMatch(/原因.{0,16}確定できず/)
  })

  it.each([
    { path: 'ping', canonical: 'https://netspeedrace.com/ping/' },
    { path: 'loaded-latency', canonical: 'https://netspeedrace.com/loaded-latency/' },
    { path: 'internet-slow-at-night', canonical: 'https://netspeedrace.com/internet-slow-at-night/' },
  ] as const)('$pathの編集情報、SEO、CTA、信頼性リンク、scriptなしを維持する', ({ path, canonical }) => {
    const page = parsePage(path)
    const articleMeta = page.querySelector('.site-pages__article-meta')?.textContent ?? ''

    expect(articleMeta).toContain('運営・編集: Net Speed Race')
    expect(articleMeta).toContain('最終更新: 2026年9月9日')
    expect(page.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(canonical)
    expect(page.querySelectorAll('a.site-pages__article-cta[href="/"]')).toHaveLength(2)
    expect(page.querySelector('a[href="/methodology/"]')).not.toBeNull()
    expect(page.querySelector('a[href="/about/"]')).not.toBeNull()
    expect(page.querySelectorAll('script')).toHaveLength(0)
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

    expect(content).toContain('ランキングへの参加は任意')
    expect(content).toContain('LocalStorage')
    expect(content).toContain('31日')
    expect(content).toContain('400日')
    expect(content).toContain('Turnstile')
    expect(content).toContain('Cloudflare')
    expect(content).toContain('IPアドレス')
    expect(content).toContain('IPアドレスのハッシュ')
    expect(content).toContain('loaded latency')
    expect(content).toContain('measurement condition label')
    expect(content).toMatch(/ランキングDBには、以下の情報を保存しません。[\s\S]*IPアドレス/)
    expect(content).toContain('広告配信を導入していません')
  })

  it('利用規約ページに全国回線品質ランキングの参加条件と参考情報である旨を含む', () => {
    const content = parsePage('terms').body.textContent ?? ''

    expect(content).toContain('全国回線品質ランキング')
    expect(content).toContain('1出走')
    expect(content).toContain('Net Speed Race独自')
    expect(content).toContain('公式')
    expect(content).toContain('不正')
  })

  it('測定方法ページにCloudflare、Ping、Jitter、loaded latencyの説明を含む', () => {
    const content = parsePage('methodology').body.textContent ?? ''

    expect(content).toContain('Cloudflare')
    expect(content).toContain('Ping')
    expect(content).toContain('Jitter')
    expect(content).toContain('loaded latency')
  })

  it('ランキングページにSEO情報、静的本文、live targetを含む', () => {
    const page = parsePage('ranking')
    const content = page.body.textContent ?? ''

    expect(page.title).toBe('全国回線品質ランキング・今日のNet Speed Score | Net Speed Race')
    expect(page.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('日本から任意参加されたNet Speed Raceの測定結果を集計。今日のNet Speed Score TOP3、中央値、上位10%ライン、直近7日の出走数を公開しています。')
    expect(page.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('website')
    expect(page.querySelector('meta[property="og:site_name"]')?.getAttribute('content')).toBe('Net Speed Race')
    expect(page.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(page.title)
    expect(page.querySelector('meta[property="og:description"]')?.getAttribute('content')).toBe('日本から任意参加されたNet Speed Raceの測定結果を集計。今日のNet Speed Score TOP3、中央値、上位10%ライン、直近7日の出走数を公開しています。')
    expect(page.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe('https://netspeedrace.com/ranking/')
    expect(page.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe('/favicon.svg')
    ;[
      'Net Speed Score', '1出走', 'Download', 'Upload', 'Ping', 'Jitter', '10出走以上',
      '1位・1位・3位', '100以上', '700 Mbps', '250 Mbps',
      '統計的な日本全国の代表値ではありません', 'ISP・通信事業者別のランキングではありません', '日本時間（JST）',
    ].forEach((text) => expect(content).toContain(text))
    ;['/privacy/', '/methodology/', '/guide/', '/internet-speed/'].forEach((href) => {
      expect(page.querySelector(`a[href="${href}"]`)).not.toBeNull()
    })
    expect(page.getElementById('ranking-live')?.getAttribute('aria-busy')).toBe('true')
    expect(page.getElementById('ranking-status')?.textContent).toBe('集計データを読み込んでいます…')
    expect(page.getElementById('ranking-retry')?.hasAttribute('hidden')).toBe(true)
    const championTerms = [...page.querySelectorAll('.ranking-champion dt')].map((term) => term.textContent)
    expect(championTerms).toContain('前日の出走数')
    expect(championTerms).not.toContain('有効出走')
    ;[
      'ranking-live', 'ranking-status', 'ranking-day', 'ranking-total-runs', 'ranking-median-score',
      'ranking-top10-score', 'ranking-top3', 'ranking-champion-source', 'ranking-champion-score',
      'ranking-champion-download', 'ranking-champion-upload', 'ranking-champion-runs', 'ranking-recent-days',
      'ranking-retry',
    ].forEach((id) => expect(page.getElementById(id)).not.toBeNull())
  })

  it('trust/guideページはscriptなしを維持し、rankingページは同一originのdefer scriptだけを含む', () => {
    ;[...trustPages, ...guidePages].forEach(({ path }) => {
      expect(parsePage(path).querySelectorAll('script')).toHaveLength(0)
    })
    const scripts = parsePage('ranking').querySelectorAll('script')

    expect(scripts).toHaveLength(1)
    expect(scripts[0].getAttribute('src')).toBe('/ranking/ranking.js')
    expect(scripts[0].defer).toBe(true)
    expect(scripts[0].textContent).toBe('')
    expect(scripts[0].getAttribute('src')?.startsWith('http')).toBe(false)
  })

  it('ガイドから全国回線品質ランキングへ案内する', () => {
    const page = parsePage('guide')
    const note = page.querySelector('.site-pages__note')

    expect(note?.textContent).toBe('現在の参加データは「全国回線品質ランキング」で確認できます。「測定方法について」と「このサイトについて」もあわせてご確認ください。')
    expect(note?.querySelector('a[href="/ranking/"]')?.textContent).toBe('全国回線品質ランキング')
  })

  it('ranking scriptは同一origin overview APIだけを安全に利用する', () => {
    const script = readPublicFile('ranking/ranking.js')

    expect(script).toContain("fetch('/api/ranking/overview'")
    ;[
      'innerHTML', 'localStorage', 'document.cookie', 'CF-Connecting-IP', 'X-Forwarded-For',
      'challenges.cloudflare.com', 'speed.cloudflare.com', 'D^0.7', 'U^0.3', 'Sref', 'Fs', 'Fp', 'Fj',
    ].forEach((text) => expect(script).not.toContain(text))
  })

  it('ranking scriptは直近の前日出走数を固定基準の説明に使用する', () => {
    const script = readPublicFile('ranking/ranking.js')

    expect(script).toContain('.filter((entry) => entry.rankingDay < rankingDay)')
    expect(script).toContain('previousDays[0]?.totalRuns ?? 0')
    expect(script).toContain('previousDayRuns < 100')
    expect(script).toContain('前日は${formatRuns(previousDayRuns)}で100走未満のため、本日は固定基準を使用しています。')
    expect(script).toContain('前日のランキングが本日の比較基準の条件を満たさないため、固定基準を使用しています。')
    expect(script).toContain('renderChampion(overview.champion, getPreviousDayRuns(overview.rankingDay, overview.recentDays))')
  })

  it('実測記事は固有のSEO情報を持ち、scriptなしで検索対象になる', () => {
    const page = parsePage(labPages[0].path)
    const description = page.querySelector('meta[name="description"]')?.getAttribute('content')
    const otherPages = staticPages.filter(({ path }) => path !== labPages[0].path).map(({ path }) => parsePage(path))
    const home = new DOMParser().parseFromString(readProjectFile('index.html'), 'text/html')

    expect(page.title).toBe('同じ条件で14回測定｜Ping・Jitter・Loaded Latencyはどれくらい変わる？ | Net Speed Race')
    expect(page.querySelector('h1')?.textContent).toBe('同じ条件で14回測ったら、Ping・Jitter・Loaded Latencyはどれくらい変わる？')
    expect(page.querySelector('.site-pages__eyebrow')?.textContent).toBe('NET SPEED RACE LAB')
    expect(description).toBeTruthy()
    ;['Net Speed Race', '実測', '14回', 'Ping', 'Jitter', 'Loaded Latency', '実データ比較'].forEach((text) => {
      expect(description).toContain(text)
    })
    ;[home, ...otherPages].forEach((other) => {
      expect(page.title).not.toBe(other.title)
      expect(description).not.toBe(other.querySelector('meta[name="description"]')?.getAttribute('content'))
    })
    expect(page.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(page.title)
    expect(page.querySelector('meta[property="og:description"]')?.getAttribute('content')).toBe(description)
    expect(page.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(labPages[0].canonical)
    expect(page.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '').not.toContain('noindex')
    expect(readPublicFile('robots.txt')).not.toMatch(/Disallow:\s*\/(?:lab|\s*$)/m)
    expect(readPublicFile('_headers')).not.toMatch(/X-Robots-Tag:.*noindex/i)
    expect(page.querySelectorAll('script')).toHaveLength(0)
    expect(page.querySelector('link[href="/site-pages.css"]')).not.toBeNull()
    expect(page.querySelector('time[datetime="2026-09-17"]')?.textContent).toBe('2026年9月17日')
  })

  it('実測記事は観測範囲、入力ラベル、独自基準と原因を断定できない旨を明記する', () => {
    const page = parsePage(labPages[0].path)
    const content = page.body.textContent ?? ''

    ;[
      '運営・編集: Net Speed Race', '公開日:', '14回', '実測', '10:11〜10:27 JST',
      '実測01_リビング6GHz', '利用者入力', '説明用架空データではありません',
      '原因を断定できない', '公式基準ではない', 'Net Speed Race独自基準',
      '0〜20 ms', '20 ms超〜100 ms', '100 ms超', 'max(0, loaded latency - idle Ping)',
      '約16分間', '1環境', '他の家庭や回線', 'Wi-Fi 6GHz一般', 'ISPやルーターが原因か',
      '時間帯による一般的傾向', '全国平均', 'サービス品質の保証',
    ].forEach((text) => expect(content).toContain(text))
    ;['/ping/', '/jitter/', '/loaded-latency/', '/methodology/', '/about/'].forEach((href) => {
      expect(page.querySelector(`article a[href="${href}"]`)).not.toBeNull()
    })
    expect(page.querySelector('a[href="/lab/ping-jitter-14-runs/data.csv"][download]')).not.toBeNull()
    expect(existsSync(resolve('public/lab/index.html'))).toBe(false)
  })

  it('CSVとHTML表は指定の14測定だけを時刻順で収録し、現行定義で増加量を計算する', () => {
    const [header, ...rows] = readLabCsv()
    const tableRows = [...parsePage(labPages[0].path).querySelectorAll('#measurements tbody tr')]

    expect(header).toEqual([
      'run', 'measuredAtJst', 'conditionLabel', 'downloadMbps', 'uploadMbps', 'pingMs', 'jitterMs',
      'downloadLoadedLatencyMs', 'uploadLoadedLatencyMs', 'downloadEffectiveIncreaseMs', 'uploadEffectiveIncreaseMs',
    ])
    expect(rows).toHaveLength(14)
    expect(tableRows).toHaveLength(14)
    labMeasurements.forEach(([time, download, upload, ping, jitter, downloadLoaded, uploadLoaded], index) => {
      const evaluation = evaluateLoadedLatencyResponsiveness({
        idleLatencyMs: ping, downloadLoadedLatencyMs: downloadLoaded, uploadLoadedLatencyMs: uploadLoaded,
      })
      const metrics = [download, upload, ping, jitter, downloadLoaded, uploadLoaded].map((value) => value.toFixed(1))
      const increases = [evaluation.download.increaseMs?.toFixed(1), evaluation.upload.increaseMs?.toFixed(1)]

      expect(rows[index]).toEqual([
        String(index + 1), `2026-09-17T${time}+09:00`, '実測01_リビング6GHz', ...metrics, ...increases,
      ])
      expect([...tableRows[index].children].map((cell) => cell.textContent)).toEqual([
        rows[index][0], time, ...rows[index].slice(3),
      ])
    })
  })

  it('集計表の平均・中央値・範囲・判定回数が14件のCSVと一致する', () => {
    const rows = readLabCsv().slice(1)
    const page = parsePage(labPages[0].path)
    const summaries = [...page.querySelectorAll('#summary tbody tr')]
    const increases = [...page.querySelectorAll('#increases tbody tr')]
    // Integer tenths prevent binary floating-point ties from changing decimal half-up rounding.
    const columns = Array.from({ length: 8 }, (_, index) => rows.map((row) => Math.round(Number(row[index + 3]) * 10)))
    const round = (tenths: number): string => (Math.round(tenths) / 10).toFixed(1)

    expect(summaries).toHaveLength(6)
    expect(increases).toHaveLength(2)
    columns.forEach((values, index) => {
      const sorted = [...values].sort((a, b) => a - b)
      const mean = round(values.reduce((sum, value) => sum + value, 0) / values.length)
      const median = round((sorted[6] + sorted[7]) / 2)
      const min = round(sorted[0])
      const max = round(sorted[13])
      const summary = index < 6
        ? [mean, median, min, max]
        : [mean, median, max, ...[
          values.filter((value) => value <= 200).length,
          values.filter((value) => value > 200 && value <= 1000).length,
          values.filter((value) => value > 1000).length,
        ].map((count) => `${count} / 14`)]
      const row = index < 6 ? summaries[index] : increases[index - 6]

      expect([...row.querySelectorAll('td')].map((cell) => cell.textContent)).toEqual(summary)
    })
    expect([...summaries[0].querySelectorAll('td')].map((cell) => cell.textContent)).toEqual(['532.3', '542.4', '436.2', '612.3'])
    expect([...summaries[2].querySelectorAll('td')].map((cell) => cell.textContent)).toEqual(['54.2', '52.7', '48.9', '62.1'])
    expect([...summaries[3].querySelectorAll('td')].map((cell) => cell.textContent)).toEqual(['12.6', '13.6', '6.2', '18.5'])
    expect([...increases[0].querySelectorAll('td')].map((cell) => cell.textContent)).toEqual(['22.4', '10.5', '89.2', '10 / 14', '4 / 14', '0 / 14'])
    expect([...increases[1].querySelectorAll('td')].map((cell) => cell.textContent)).toEqual(['14.5', '10.4', '68.1', '12 / 14', '2 / 14', '0 / 14'])
  })

  it.each([
    { file: 'ping-jitter.svg', series: ['Ping', 'Jitter'], columns: [5, 6], unit: 'ms' },
    { file: 'loaded-latency.svg', series: ['Download effective increase', 'Upload effective increase'], columns: [9, 10], unit: 'ms' },
    { file: 'throughput.svg', series: ['Download', 'Upload'], columns: [3, 4], unit: 'Mbps' },
  ])('$fileは説明付きの静的SVGで全14点をCSVと同じ値・位置で描画する', ({ file, series, columns, unit }) => {
    const page = parsePage(labPages[0].path)
    const img = page.querySelector(`img[src="/lab/ping-jitter-14-runs/${file}"]`)
    const svg = new DOMParser().parseFromString(readPublicFile(`${labPages[0].path}/${file}`), 'image/svg+xml')
    const rows = readLabCsv().slice(1)

    expect(img?.getAttribute('alt')).toBeTruthy()
    expect(svg.querySelector('parsererror')).toBeNull()
    expect(svg.querySelector('svg > title')?.textContent).toBeTruthy()
    expect(svg.querySelector('svg > desc')?.textContent).toBeTruthy()
    expect(svg.querySelectorAll('script, foreignObject, animate')).toHaveLength(0)
    series.forEach((name, seriesIndex) => {
      const group = svg.querySelector(`g[aria-label="${name}"]`)
      const points = [...group?.querySelectorAll('circle, rect') ?? []]
      const line = group?.querySelector('polyline')?.getAttribute('points')?.split(' ').map((point) => point.split(',').map(Number))
      const top = file === 'throughput.svg' ? [120, 438][seriesIndex] : 108
      const bottom = file === 'throughput.svg' ? [315, 630][seriesIndex] : 355
      const limit = file === 'throughput.svg' ? [700, 70][seriesIndex] : file === 'ping-jitter.svg' ? 70 : 100

      expect(points).toHaveLength(14)
      expect(line).toHaveLength(14)
      points.forEach((point, index) => {
        expect(point.querySelector('title')?.textContent).toBe(`測定${index + 1}：${name} ${rows[index][columns[seriesIndex]]} ${unit}`)
        const x = 64 + 656 * index / 13
        const y = bottom - Number(rows[index][columns[seriesIndex]]) / limit * (bottom - top)
        const circle = point.tagName === 'circle'
        expect(Number(point.getAttribute(circle ? 'cx' : 'x')) + (circle ? 0 : 4)).toBeCloseTo(x, 1)
        expect(Number(point.getAttribute(circle ? 'cy' : 'y')) + (circle ? 0 : 4)).toBeCloseTo(y, 1)
        expect(line?.[index][0]).toBeCloseTo(x, 1)
        expect(line?.[index][1]).toBeCloseTo(y, 1)
      })
    })
  })

  it.each(['ping', 'jitter', 'loaded-latency', 'guide'])('%sから実測記事へ1か所案内する', (path) => {
    expect(parsePage(path).querySelectorAll('article a[href="/lab/ping-jitter-14-runs/"]')).toHaveLength(1)
  })

  it('sitemapに17個の重複しない公開URLを含む', () => {
    const sitemap = readPublicFile('sitemap.xml')
    const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, url]) => url)

    expect(urls).toEqual([
      'https://netspeedrace.com/',
      ...staticPages.map(({ canonical }) => canonical),
    ])
    expect(new Set(urls).size).toBe(17)
    expect(sitemap).not.toContain('404.html')
  })
})
