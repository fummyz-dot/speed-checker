import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpeedMeasurementResult } from '../../types/measurement'
import { RankingCard } from './RankingCard'
import type { RankingContext, RankingService, RankingSubmissionResult } from './types'
import { requestRankingTurnstileToken } from './turnstile'

vi.mock('./turnstile', () => ({ requestRankingTurnstileToken: vi.fn() }))

const measurement: SpeedMeasurementResult = {
  id: 'measurement-1', measuredAt: '2026-08-28T12:00:00.000Z',
  downloadMbps: 300, uploadMbps: 100, pingMs: 20, jitterMs: 5,
}

const champion = {
  source: 'previous_day_winner' as const,
  sourceDay: '2026-08-27', scoreTenths: 16834,
  downloadMbps: 534.8, uploadMbps: 327.2, qualifyingRuns: 2847,
}

const eligibleContext: RankingContext = {
  ok: true, rankingAvailable: true, rankingDay: '2026-08-28',
  ticket: 'private-ticket-not-rendered', ticketExpiresAtMs: 1, champion,
}

const successfulSubmission: RankingSubmissionResult = {
  ok: true,
  entry: { scoreTenths: 15247, rank: 128, tieCount: 1, totalRuns: 2847, topPercentTenths: 45 },
  top3: [
    { rank: 1, scoreTenths: 18432 },
    { rank: 1, scoreTenths: 17228 },
    { rank: 3, scoreTenths: 16804 },
  ],
  champion,
}

const overview = {
  ok: true as const,
  rankingDay: '2026-08-28',
  totalRuns: 12,
  top3: [
    { rank: 1, scoreTenths: 8503 },
    { rank: 2, scoreTenths: 7594 },
    { rank: 3, scoreTenths: 7110 },
  ],
}

const service = (
  submitMeasurement = vi.fn().mockResolvedValue(successfulSubmission),
  getOverview = vi.fn().mockResolvedValue(overview),
): RankingService => ({
  getContext: vi.fn(),
  getOverview,
  submitMeasurement,
})

describe('RankingCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requestRankingTurnstileToken).mockResolvedValue('turnstile-token')
  })

  it('shows an opt-in invitation without a score formula before submission', () => {
    render(<RankingCard context={eligibleContext} service={service()} measurement={measurement} />)

    expect(screen.getByRole('heading', { name: '本日の全国回線品質ランキング' })).toBeVisible()
    expect(screen.getByText('あなたの結果は全国で何位？')).toBeVisible()
    expect(screen.getByText('匿名・任意参加。参加するとNet Speed Scoreと今日の順位を確認できます。')).toBeVisible()
    expect(screen.getByRole('button', { name: '全国ランキングに参加して順位を見る' })).toHaveClass('ranking-card__submit--attention')
    expect(screen.getByRole('button', { name: '全国ランキングに参加して順位を見る' })).toBeEnabled()
    expect(screen.getByText(/一つの指標だけが突出していても高得点になりにくい/)).toBeVisible()
    expect(document.body.textContent).not.toMatch(/log\(|係数|Sref|Ping\/Jitter補正式/)
  })

  it('shows the current leader before ranking participation', async () => {
    render(<RankingCard context={eligibleContext} service={service()} measurement={measurement} />)

    expect(await screen.findByText('現在の1位（取得時点）')).toBeVisible()
    expect(screen.getByText('850.3')).toBeVisible()
    expect(screen.getByText('12出走のトップ')).toBeVisible()
  })

  it('shows that the current ranking has no leader yet', async () => {
    const emptyOverview = { ...overview, totalRuns: 0, top3: [] }
    render(<RankingCard context={eligibleContext} service={service(undefined, vi.fn().mockResolvedValue(emptyOverview))} measurement={measurement} />)

    expect(await screen.findByText('まだありません')).toBeVisible()
    expect(screen.getByText('今日最初の1位を狙えます。')).toBeVisible()
  })

  it('keeps participation enabled when the overview cannot be loaded', async () => {
    render(<RankingCard context={eligibleContext} service={service(undefined, vi.fn().mockRejectedValue(new Error('unavailable')))} measurement={measurement} />)

    await waitFor(() => expect(screen.queryByText('現在の1位を確認中…')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: '全国ランキングに参加して順位を見る' })).toBeEnabled()
    expect(screen.queryByText('ランキングを利用できませんでした。測定結果には影響ありません。')).not.toBeInTheDocument()
    expect(requestRankingTurnstileToken).not.toHaveBeenCalled()
  })

  it('renders the integer-tenths success contract, tie ranks, top percentage, and top three', async () => {
    render(<RankingCard context={eligibleContext} service={service()} measurement={measurement} />)
    fireEvent.click(screen.getByRole('button', { name: '全国ランキングに参加して順位を見る' }))

    expect(await screen.findByText('1524.7')).toBeVisible()
    expect(screen.getByText('128位')).toBeVisible()
    expect(screen.getByText('上位4.5%')).toBeVisible()
    expect(screen.getByRole('heading', { name: "TODAY'S TOP 3" })).toBeVisible()
    expect(screen.getAllByText('1位')).toHaveLength(2)
    expect(screen.getByText('3位')).toBeVisible()
    expect(document.body.textContent).not.toContain('private-ticket-not-rendered')
  })

  it('disables the opt-in button while the optional ranking submission is pending', async () => {
    let completeSubmission: ((value: RankingSubmissionResult) => void) | undefined
    const submitMeasurement = vi.fn(() => new Promise<RankingSubmissionResult>((resolve) => {
      completeSubmission = resolve
    }))
    render(<RankingCard context={eligibleContext} service={service(submitMeasurement)} measurement={measurement} />)

    fireEvent.click(screen.getByRole('button', { name: '全国ランキングに参加して順位を見る' }))
    const pendingButton = screen.getByRole('button', { name: 'ランキングに登録中…' })
    expect(pendingButton).toBeDisabled()
    expect(pendingButton).not.toHaveClass('ranking-card__submit--attention')
    await waitFor(() => expect(submitMeasurement).toHaveBeenCalledTimes(1))
    completeSubmission?.(successfulSubmission)
    expect(await screen.findByText('1524.7')).toBeVisible()
  })

  it('keeps the completed measurement available when submission fails and permits a retry', async () => {
    const submitMeasurement = vi.fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(successfulSubmission)
    render(<RankingCard context={eligibleContext} service={service(submitMeasurement)} measurement={measurement} />)

    fireEvent.click(screen.getByRole('button', { name: '全国ランキングに参加して順位を見る' }))
    expect(await screen.findByText('ランキングを利用できませんでした。測定結果には影響ありません。')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'もう一度試す' }))
    expect(await screen.findByText('1524.7')).toBeVisible()
    expect(submitMeasurement).toHaveBeenCalledTimes(2)
    expect(requestRankingTurnstileToken).toHaveBeenCalledTimes(2)
    expect(submitMeasurement).toHaveBeenLastCalledWith(measurement, 'turnstile-token')
  })

  it('does not show a percentage below ten runs or a champion comparison without a champion score', async () => {
    const fallbackSubmission: RankingSubmissionResult = {
      ...successfulSubmission,
      entry: { ...successfulSubmission.entry, totalRuns: 9, topPercentTenths: null, tieCount: 2 },
      champion: { ...champion, source: 'fallback', sourceDay: null, scoreTenths: null },
    }
    render(<RankingCard context={eligibleContext} service={service(vi.fn().mockResolvedValue(fallbackSubmission))} measurement={measurement} />)
    fireEvent.click(screen.getByRole('button', { name: '全国ランキングに参加して順位を見る' }))

    expect(await screen.findByText('同率128位')).toBeVisible()
    expect(screen.queryByText(/上位[\d.]+%/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('無敗の三冠馬との比較')).not.toBeInTheDocument()
  })

  it.each([
    [1, 1, '現在、本日の全国1位！', 'ranking-card__celebration--rank-1'],
    [2, 1, '現在、本日の全国2位！', 'ranking-card__celebration--rank-2'],
    [3, 2, '現在、本日の全国 同率3位！', 'ranking-card__celebration--rank-3'],
  ])('celebrates a current rank %i finish', async (rank, tieCount, message, className) => {
    const top3Submission = {
      ...successfulSubmission,
      entry: { ...successfulSubmission.entry, rank, tieCount },
    }
    render(<RankingCard context={eligibleContext} service={service(vi.fn().mockResolvedValue(top3Submission))} measurement={measurement} />)
    fireEvent.click(screen.getByRole('button', { name: '全国ランキングに参加して順位を見る' }))

    const celebration = await screen.findByRole('status')
    expect(celebration).toHaveClass(className)
    expect(celebration).toHaveTextContent('CONGRATULATIONS')
    expect(celebration).toHaveTextContent(message)
    expect(celebration).toHaveTextContent('TOP 3入りです。ランキングは出走ごとに更新されます。')
  })

  it('does not celebrate a rank below the top three', async () => {
    const fourthPlaceSubmission = {
      ...successfulSubmission,
      entry: { ...successfulSubmission.entry, rank: 4 },
    }
    render(<RankingCard context={eligibleContext} service={service(vi.fn().mockResolvedValue(fourthPlaceSubmission))} measurement={measurement} />)
    fireEvent.click(screen.getByRole('button', { name: '全国ランキングに参加して順位を見る' }))

    expect(await screen.findByText('4位')).toBeVisible()
    expect(screen.queryByText('CONGRATULATIONS')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('keeps ranking optional for a non-JP context', () => {
    render(
      <RankingCard
        context={{
          ...eligibleContext,
          rankingAvailable: false,
          ticket: null,
          ticketExpiresAtMs: null,
          unavailableReason: 'country_not_eligible',
        }}
        service={service()}
        measurement={measurement}
      />,
    )
    expect(screen.getByText(/日本国内と判定された測定のみ参加できます/)).toBeVisible()
    expect(screen.queryByRole('button', { name: '全国ランキングに参加して順位を見る' })).not.toBeInTheDocument()
  })

  it('does not run Turnstile or submit when Ping or Jitter is unavailable', () => {
    const submitMeasurement = vi.fn()
    render(<RankingCard context={eligibleContext} service={service(submitMeasurement)} measurement={{ ...measurement, pingMs: null }} />)

    fireEvent.click(screen.getByRole('button', { name: '全国ランキングに参加して順位を見る' }))

    expect(screen.getByText('今回の測定ではPingまたはJitterを取得できなかったため、ランキングには参加できません。')).toBeVisible()
    expect(requestRankingTurnstileToken).not.toHaveBeenCalled()
    expect(submitMeasurement).not.toHaveBeenCalled()
  })
})
