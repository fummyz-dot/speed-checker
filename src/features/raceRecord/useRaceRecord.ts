import { useCallback, useEffect, useState } from 'react'
import { fetchRankingEntryResult } from '../ranking/rankingService'
import type { RankingSubmissionResult } from '../ranking/types'
import {
  getPendingFinalLookups,
  jstDay,
  loadRaceRecord,
  recordFinalPlacing,
  recordMeasurement,
  recordRankingStart,
  type RaceRecord,
} from '../../lib/raceRecord'
import type { SpeedMeasurementResult } from '../../types/measurement'

interface UseRaceRecordResult {
  record: RaceRecord
  today: string
  isNewBestDownload: boolean
  addRankingStart: (measurementId: string, submission: RankingSubmissionResult) => void
}

/**
 * Keeps the browser-local race record in step with completed measurements and, when ranking is
 * enabled, looks up the final placing of the latest finished ranking day once per page load.
 */
export const useRaceRecord = (
  rankingEnabled: boolean,
  completedResult: SpeedMeasurementResult | null,
): UseRaceRecordResult => {
  const [record, setRecord] = useState<RaceRecord>(() => loadRaceRecord())
  const [newBestId, setNewBestId] = useState<string | null>(null)
  const [today] = useState(() => jstDay(Date.now()))

  useEffect(() => {
    if (!rankingEnabled) return
    const pending = getPendingFinalLookups(loadRaceRecord(), today)
    if (pending.length === 0) return
    let isCurrent = true
    void Promise.all(pending.map(async (start) => {
      try {
        const result = await fetchRankingEntryResult(start.measurementId)
        if (result === null) {
          recordFinalPlacing(start.measurementId, null)
        } else if (result.final) {
          recordFinalPlacing(start.measurementId, {
            rankingDay: result.rankingDay,
            placing: { rank: result.rank, tieCount: result.tieCount, totalRuns: result.totalRuns },
          })
        }
      } catch {
        // Try again on a later visit.
      }
    })).then(() => {
      if (isCurrent) setRecord(loadRaceRecord())
    })
    return () => {
      isCurrent = false
    }
  }, [rankingEnabled, today])

  useEffect(() => {
    if (!completedResult) return
    const outcome = recordMeasurement(completedResult)
    setRecord(outcome.record)
    setNewBestId(outcome.isNewBestDownload ? completedResult.id : null)
  }, [completedResult])

  const addRankingStart = useCallback((measurementId: string, submission: RankingSubmissionResult) => {
    setRecord(recordRankingStart({
      measurementId,
      rankingDay: jstDay(Date.now()),
      scoreTenths: submission.entry.scoreTenths,
      atEntry: {
        rank: submission.entry.rank,
        tieCount: submission.entry.tieCount,
        totalRuns: submission.entry.totalRuns,
      },
    }))
  }, [])

  return {
    record,
    today,
    isNewBestDownload: completedResult !== null && newBestId === completedResult.id,
    addRankingStart,
  }
}
