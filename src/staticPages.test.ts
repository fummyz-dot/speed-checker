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

const rankingPages = [
  { path: 'ranking', canonical: 'https://netspeedrace.com/ranking/' },
] as const

const staticPages = [...trustPages, ...guidePages, ...rankingPages]

const readPublicFile = (path: string): string =>
  readFileSync(resolve('public', path), 'utf8')

const parsePage = (path: string): Document =>
  new DOMParser().parseFromString(readPublicFile(`${path}/index.html`), 'text/html')

describe('public static pages', () => {
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

  it('sitemapに16個の重複しない公開URLを含む', () => {
    const sitemap = readPublicFile('sitemap.xml')
    const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, url]) => url)

    expect(urls).toEqual([
      'https://netspeedrace.com/',
      ...staticPages.map(({ canonical }) => canonical),
    ])
    expect(new Set(urls).size).toBe(16)
  })
})
