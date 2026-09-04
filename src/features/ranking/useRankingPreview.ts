import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_RACE_CHAMPION_REFERENCE, type RaceChampionReference } from '../../types/raceChampion'
import { createRankingApiService } from './rankingService'
import type { RankingContext, RankingService } from './types'

interface UseRankingPreviewResult {
  context: RankingContext | null
  championReference: RaceChampionReference
  isPreparingContext: boolean
  service: RankingService | null
  prepareMeasurement: () => Promise<boolean>
}

export const useRankingPreview = (enabled: boolean): UseRankingPreviewResult => {
  const serviceRef = useRef<RankingService | null>(null)
  const preparingRef = useRef(false)
  const [context, setContext] = useState<RankingContext | null>(null)
  const [championReference, setChampionReference] = useState<RaceChampionReference>(
    DEFAULT_RACE_CHAMPION_REFERENCE,
  )
  const [isPreparingContext, setIsPreparingContext] = useState(false)

  useEffect(() => {
    if (enabled) return
    serviceRef.current = null
    preparingRef.current = false
    setContext(null)
    setChampionReference(DEFAULT_RACE_CHAMPION_REFERENCE)
    setIsPreparingContext(false)
  }, [enabled])

  const prepareMeasurement = useCallback(async (): Promise<boolean> => {
    if (!enabled) return true
    if (preparingRef.current) return false

    preparingRef.current = true
    setIsPreparingContext(true)
    setContext(null)
    setChampionReference(DEFAULT_RACE_CHAMPION_REFERENCE)

    const service = serviceRef.current ?? createRankingApiService()
    serviceRef.current = service
    try {
      const nextContext = await service.getContext()
      setContext(nextContext)
      setChampionReference(nextContext.champion)
    } catch {
      // Ranking is optional. The measurement continues with the established benchmark.
      setContext(null)
      setChampionReference(DEFAULT_RACE_CHAMPION_REFERENCE)
    } finally {
      preparingRef.current = false
      setIsPreparingContext(false)
    }
    return true
  }, [enabled])

  return {
    context,
    championReference,
    isPreparingContext,
    service: enabled ? serviceRef.current : null,
    prepareMeasurement,
  }
}
