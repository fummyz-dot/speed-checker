import { useEffect, useState } from 'react'
import { getDownloadPosition, type DownloadPosition } from '../../lib/downloadPosition'
import type { SpeedMeasurementResult } from '../../types/measurement'
import type { RankingService } from './types'

/**
 * After a completed measurement, reads the public overview once and places the download
 * result within the recent distribution. Nothing about the measurement is sent.
 */
export const useDownloadPosition = (
  service: RankingService | null,
  result: SpeedMeasurementResult | null,
): DownloadPosition | null => {
  const [position, setPosition] = useState<{ id: string, value: DownloadPosition } | null>(null)

  useEffect(() => {
    if (!service || !result || typeof service.getOverview !== 'function') return
    let isCurrent = true
    service.getOverview()
      .then((overview) => {
        const value = getDownloadPosition(result.downloadMbps, overview.downloadDistribution)
        if (isCurrent) setPosition(value ? { id: result.id, value } : null)
      })
      .catch(() => {
        if (isCurrent) setPosition(null)
      })
    return () => {
      isCurrent = false
    }
  }, [result, service])

  return position && result && position.id === result.id ? position.value : null
}
