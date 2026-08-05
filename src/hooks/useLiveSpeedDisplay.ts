import { useEffect, useRef, useState } from 'react'
import { normalizeSpeedValue } from '../lib/speedValue'

interface UseLiveSpeedDisplayOptions {
  actualMeasuredMbps: number | null
  finalMeasuredMbps: number | null
  isMeasuring: boolean
}

const LIVE_UPDATE_INTERVAL_MS = 48
const SMOOTHING_FACTOR = 0.28

export const createLiveSpeedFrame = (value: number, randomFraction = Math.random()): number => {
  const normalized = normalizeSpeedValue(value) ?? 0
  if (normalized === 0) return 0

  const precision = normalized >= 1 ? 10 : normalized >= 0.01 ? 100 : 10_000
  const stableLeadingDigits = Math.floor(normalized * precision) / precision
  const rouletteTailRange = 1 / precision
  return normalizeSpeedValue(stableLeadingDigits + randomFraction * rouletteTailRange) ?? 0
}

export const useLiveSpeedDisplay = ({
  actualMeasuredMbps,
  finalMeasuredMbps,
  isMeasuring,
}: UseLiveSpeedDisplayOptions): number | null => {
  const actualValueRef = useRef(normalizeSpeedValue(actualMeasuredMbps))
  const [displayAnimatedMbps, setDisplayAnimatedMbps] = useState<number | null>(
    normalizeSpeedValue(finalMeasuredMbps ?? actualMeasuredMbps),
  )

  actualValueRef.current = normalizeSpeedValue(actualMeasuredMbps)

  useEffect(() => {
    if (!isMeasuring || actualValueRef.current === null) {
      setDisplayAnimatedMbps(normalizeSpeedValue(finalMeasuredMbps ?? actualValueRef.current))
      return
    }

    let animationFrame: number | null = null
    let lastUpdate = -LIVE_UPDATE_INTERVAL_MS
    let smoothedValue = actualValueRef.current

    const updateDisplay = (timestamp: number) => {
      const actualValue = actualValueRef.current
      if (actualValue !== null && timestamp - lastUpdate >= LIVE_UPDATE_INTERVAL_MS) {
        smoothedValue += (actualValue - smoothedValue) * SMOOTHING_FACTOR
        setDisplayAnimatedMbps(createLiveSpeedFrame(smoothedValue))
        lastUpdate = timestamp
      }
      animationFrame = window.requestAnimationFrame(updateDisplay)
    }

    animationFrame = window.requestAnimationFrame(updateDisplay)
    return () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
    }
  }, [finalMeasuredMbps, isMeasuring])

  return displayAnimatedMbps
}
