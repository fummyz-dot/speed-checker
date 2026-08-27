import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SpeedMeasurementResult } from '../../types/measurement'
import { RankingCard } from './RankingCard'
import type { RankingContext, RankingService, RankingSubmissionResult } from './types'

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

const service = (submitMeasurement = vi.fn().mockResolvedValue(successfulSubmission)): RankingService => ({
  getContext: vi.fn(),
  submitMeasurement,
})

describe('RankingCard', () => {
  it('shows an opt-in explanation without a score formula before submission', () => {
    render(<RankingCard context={eligibleContext} service={service()} measurement={measurement} />)

    expect(screen.getByRole('heading', { name: '本日の全国回線品質ランキング' })).toBeVisible()
    expect(screen.getByRole('button', { name: '匿名でランキングに参加してスコアを見る' })).toBeEnabled()
    expect(screen.getByText(/一つの指標だけが突出していても高得点になりにくい/)).toBeVisible()
    expect(document.body.textContent).not.toMatch(/log\(|係数|Sref|Ping\/Jitter補正式/)
  })

  it('renders the integer-tenths success contract, tie ranks, top percentage, and top three', async () => {
    render(<RankingCard context={eligibleContext} service={service()} measurement={measurement} />)
    fireEvent.click(screen.getByRole('button', { name: '匿名でランキングに参加してスコアを見る' }))

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

    fireEvent.click(screen.getByRole('button', { name: '匿名でランキングに参加してスコアを見る' }))
    expect(screen.getByRole('button', { name: 'ランキングに登録中…' })).toBeDisabled()
    completeSubmission?.(successfulSubmission)
    expect(await screen.findByText('1524.7')).toBeVisible()
  })

  it('keeps the completed measurement available when submission fails and permits a retry', async () => {
    const submitMeasurement = vi.fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(successfulSubmission)
    render(<RankingCard context={eligibleContext} service={service(submitMeasurement)} measurement={measurement} />)

    fireEvent.click(screen.getByRole('button', { name: '匿名でランキングに参加してスコアを見る' }))
    expect(await screen.findByText('ランキングを利用できませんでした。測定結果には影響ありません。')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'もう一度試す' }))
    expect(await screen.findByText('1524.7')).toBeVisible()
    expect(submitMeasurement).toHaveBeenCalledTimes(2)
    expect(submitMeasurement).toHaveBeenLastCalledWith(measurement)
  })

  it('does not show a percentage below ten runs or a champion comparison without a champion score', async () => {
    const fallbackSubmission: RankingSubmissionResult = {
      ...successfulSubmission,
      entry: { ...successfulSubmission.entry, totalRuns: 9, topPercentTenths: null, tieCount: 2 },
      champion: { ...champion, source: 'fallback', sourceDay: null, scoreTenths: null },
    }
    render(<RankingCard context={eligibleContext} service={service(vi.fn().mockResolvedValue(fallbackSubmission))} measurement={measurement} />)
    fireEvent.click(screen.getByRole('button', { name: '匿名でランキングに参加してスコアを見る' }))

    expect(await screen.findByText('同率128位')).toBeVisible()
    expect(screen.queryByText(/上位[\d.]+%/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('無敗の三冠馬との比較')).not.toBeInTheDocument()
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
    expect(screen.queryByRole('button', { name: '匿名でランキングに参加してスコアを見る' })).not.toBeInTheDocument()
  })
})
