import type { RankingContext, RankingService, RankingSubmissionResult } from './types'

const previewChampion = {
  source: 'previous_day_winner' as const,
  sourceDay: '2026-08-27',
  scoreTenths: 16834,
  downloadMbps: 534.8,
  uploadMbps: 327.2,
  qualifyingRuns: 2847,
}

const previewContext: RankingContext = {
  ok: true,
  rankingAvailable: true,
  rankingDay: '2026-08-28',
  ticket: 'preview-only-ticket',
  ticketExpiresAtMs: 1_788_000_000_000,
  champion: previewChampion,
}

const previewSubmission: RankingSubmissionResult = {
  ok: true,
  entry: {
    scoreTenths: 15247,
    rank: 128,
    tieCount: 1,
    totalRuns: 2847,
    topPercentTenths: 45,
  },
  top3: [
    { rank: 1, scoreTenths: 18432 },
    { rank: 2, scoreTenths: 17228 },
    { rank: 3, scoreTenths: 16804 },
  ],
  champion: previewChampion,
}

const cloneContext = (): RankingContext => ({
  ...previewContext,
  champion: { ...previewContext.champion },
})

const cloneSubmission = (): RankingSubmissionResult => ({
  ...previewSubmission,
  entry: { ...previewSubmission.entry },
  top3: previewSubmission.top3.map((entry) => ({ ...entry })),
  champion: { ...previewSubmission.champion },
})

/**
 * Phase B has no public API call. This isolates fixed preview fixtures so a
 * future Service Binding client can replace only this implementation.
 */
export const createRankingPreviewService = (): RankingService => ({
  async getContext() {
    return cloneContext()
  },
  async submitMeasurement() {
    return cloneSubmission()
  },
})
