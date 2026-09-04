import { afterEach, describe, expect, it, vi } from 'vitest'
import { isRankingEnabled } from './rankingFeature'

afterEach(() => vi.unstubAllEnvs())

describe('isRankingEnabled', () => {
  it('defaults to false outside production', () => {
    vi.stubEnv('PROD', false)

    expect(isRankingEnabled()).toBe(false)
  })

  it('defaults to true in production', () => {
    vi.stubEnv('PROD', true)

    expect(isRankingEnabled()).toBe(true)
  })

  it('enables ranking with an explicit true override', () => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('VITE_RANKING_ENABLED', 'true')

    expect(isRankingEnabled()).toBe(true)
  })

  it('disables ranking with an explicit false override', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_RANKING_ENABLED', 'false')

    expect(isRankingEnabled()).toBe(false)
  })
})
