import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('static homepage HTML', () => {
  it('links directly to the measurement lab from static content below the service description', () => {
    const html = readFileSync('index.html', 'utf8')
    const staticDocument = new DOMParser().parseFromString(html, 'text/html')
    const lab = staticDocument.querySelector('section[aria-labelledby="home-lab-title"]')
    const serviceInfo = staticDocument.querySelector('section[aria-labelledby="home-service-info-title"]')
    const footer = staticDocument.querySelector('footer.site-footer')
    const link = lab?.querySelector('a')

    expect(lab?.querySelector('h2')?.textContent).toBe('実測Lab')
    expect(lab?.textContent).toContain('Net Speed Raceで実際に測定したデータを公開')
    expect(lab?.textContent).toContain('14回の実測・生データCSV公開・グラフと集計付き。')
    expect(link?.getAttribute('href')).toBe('/lab/ping-jitter-14-runs/')
    expect(link?.hasAttribute('onclick')).toBe(false)
    expect(serviceInfo?.compareDocumentPosition(lab as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(lab?.compareDocumentPosition(footer as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('includes crawlable service content after the React root', () => {
    const html = readFileSync('index.html', 'utf8')
    const staticDocument = new DOMParser().parseFromString(html, 'text/html')
    const root = staticDocument.getElementById('root')
    const staticContent = staticDocument.getElementById('home-static-content')

    expect(root).not.toBeNull()
    expect(staticContent).not.toBeNull()
    expect(root?.compareDocumentPosition(staticContent as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(staticContent?.hasAttribute('hidden')).toBe(false)

    const serviceInfo = staticContent?.querySelector('section.home-service-info')
    const footer = staticContent?.querySelector('footer.site-footer')

    expect(serviceInfo).not.toBeNull()
    expect(footer).not.toBeNull()
    expect(staticContent?.textContent).toContain('Net Speed Raceとは')
    expect(staticContent?.textContent).toContain('Net Speed Score')
    expect(staticContent?.textContent).toContain('通信品質の公式規格ではなく')

    const serviceLinks = [
      ['全国ランキングを見る', '/ranking/'],
      ['測定方法を詳しく見る', '/methodology/'],
      ['Net Speed Raceについて', '/about/'],
    ] as const
    serviceLinks.forEach(([name, href]) => {
      const link = [...(serviceInfo?.querySelectorAll('a') ?? [])].find(
        (element) => element.querySelector('span')?.textContent?.trim() === name,
      )
      expect(link?.getAttribute('href')).toBe(href)
    })

    const footerLinks = [
      ['全国ランキング', '/ranking/'],
      ['回線品質ガイド', '/guide/'],
      ['このサイトについて', '/about/'],
      ['測定方法', '/methodology/'],
      ['プライバシー', '/privacy/'],
      ['お問い合わせ', '/contact/'],
      ['利用規約', '/terms/'],
    ] as const
    footerLinks.forEach(([name, href]) => {
      const link = [...(footer?.querySelectorAll('a') ?? [])].find((element) => element.textContent?.trim() === name)
      expect(link?.getAttribute('href')).toBe(href)
    })

    const githubLink = [...(footer?.querySelectorAll('a') ?? [])].find(
      (element) => element.textContent?.trim() === 'GitHubでソースコードを見る',
    )
    expect(githubLink?.getAttribute('href')).toBe('https://github.com/fummyz-dot/speed-checker')
    expect(githubLink?.getAttribute('target')).toBe('_blank')
    expect(githubLink?.getAttribute('rel')?.split(/\s+/)).toEqual(expect.arrayContaining(['noreferrer', 'noopener']))
    expect(footer?.textContent).toContain('Powered by Cloudflare Speedtest')
    expect(footer?.textContent).toContain('© Net Speed Race')
  })
})
