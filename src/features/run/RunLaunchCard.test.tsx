import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpeedMeasurementResult } from '../../types/measurement'
import { RunLaunchCard } from './RunLaunchCard'
import { RunTicketIssueError } from './runTicketService'

const measurement: SpeedMeasurementResult = {
  id: 'measurement-1',
  measuredAt: '2026-09-08T12:00:00.000Z',
  downloadMbps: 300,
  uploadMbps: 100,
  pingMs: 20,
  jitterMs: 5,
}

const issued = { ok: true as const, ticket: 'run-ticket', expiresAtMs: 1_800_000_000_000 }

describe('RunLaunchCard', () => {
  beforeEach(() => window.sessionStorage.clear())

  it('renders for a completed eligible measurement and launches only after an explicit click', async () => {
    let resolveIssue: ((value: typeof issued) => void) | undefined
    const issue = vi.fn(() => new Promise<typeof issued>((resolve) => { resolveIssue = resolve }))
    const save = vi.fn()
    const navigate = vi.fn()
    render(<RunLaunchCard measurement={measurement} issue={issue} save={save} navigate={navigate} />)

    expect(screen.getByRole('heading', { name: 'この測定結果で走る' })).toBeVisible()
    expect(issue).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'NET SPEED RUNを開始' }))
    const loadingButton = screen.getByRole('button', { name: 'ゲームを準備中…' })
    expect(loadingButton).toBeDisabled()
    fireEvent.click(loadingButton)
    expect(issue).toHaveBeenCalledTimes(1)
    expect(issue).toHaveBeenCalledWith(measurement)

    resolveIssue?.(issued)
    await waitFor(() => expect(save).toHaveBeenCalledWith(issued))
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('stores the issued ticket in sessionStorage before navigation', async () => {
    const issue = vi.fn().mockResolvedValue(issued)
    const navigate = vi.fn()
    render(<RunLaunchCard measurement={measurement} issue={issue} navigate={navigate} />)

    fireEvent.click(screen.getByRole('button', { name: 'NET SPEED RUNを開始' }))

    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1))
    expect(window.sessionStorage.getItem('net-speed-run-ticket-v1')).toBe(JSON.stringify({
      version: 1, ticket: 'run-ticket', expiresAtMs: 1_800_000_000_000,
    }))
  })

  it('keeps the result card available and permits retry after a backend failure', async () => {
    const issue = vi.fn()
      .mockRejectedValueOnce(new RunTicketIssueError('SERVICE_UNAVAILABLE'))
      .mockResolvedValueOnce(issued)
    const navigate = vi.fn()
    const save = vi.fn()
    render(<RunLaunchCard measurement={measurement} issue={issue} save={save} navigate={navigate} />)

    fireEvent.click(screen.getByRole('button', { name: 'NET SPEED RUNを開始' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('ゲームを準備できませんでした')
    expect(screen.getByRole('heading', { name: 'この測定結果で走る' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'NET SPEED RUNを開始' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'NET SPEED RUNを開始' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1))
    expect(issue).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['Ping', { ...measurement, pingMs: null }],
    ['Jitter', { ...measurement, jitterMs: null }],
    ['undefined Jitter', { ...measurement, jitterMs: undefined }],
  ])('disables launch without %s and never calls the API', (_caseName, ineligibleMeasurement) => {
    const issue = vi.fn()
    render(<RunLaunchCard measurement={ineligibleMeasurement} issue={issue} />)

    expect(screen.getByRole('button', { name: 'NET SPEED RUNを開始' })).toBeDisabled()
    expect(screen.getByText(/Pingまたはジッターを取得できなかったため/)).toBeVisible()
    expect(issue).not.toHaveBeenCalled()
  })

  it('treats a backend measurement rejection as ineligible', async () => {
    const issue = vi.fn().mockRejectedValue(new RunTicketIssueError('MEASUREMENT_NOT_ELIGIBLE'))
    render(<RunLaunchCard measurement={measurement} issue={issue} />)

    fireEvent.click(screen.getByRole('button', { name: 'NET SPEED RUNを開始' }))

    expect(await screen.findByText(/今回の測定結果ではNet Speed Runを開始できません/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'NET SPEED RUNを開始' })).toBeDisabled()
  })
})
