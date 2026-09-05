import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('static homepage HTML', () => {
  it('includes crawlable service content after the React root', () => {
    const html = readFileSync('index.html', 'utf8')

    expect(html).toContain('id="home-static-content"')
    expect(html).toContain('Net Speed Raceとは')
    expect(html).toContain('Net Speed Score')
    expect(html).toContain('通信品質の公式規格ではなく')
    expect(html).toContain('href="/ranking/"')
    expect(html).toContain('href="/methodology/"')
    expect(html).toContain('href="/about/"')
    expect(html).toContain('class="site-footer"')
    expect(html.indexOf('id="root"')).toBeLessThan(html.indexOf('id="home-static-content"'))
    expect(html).toMatch(/<div id="home-static-content" class="site-shell home-static-content">/)
  })
})
