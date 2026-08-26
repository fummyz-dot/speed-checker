import { useEffect, useState } from 'react'

const getMediaQueryMatch = (query: string): boolean =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia(query).matches

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => getMediaQueryMatch(query))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mediaQueryList = window.matchMedia(query)
    const updateMatches = () => setMatches(mediaQueryList.matches)
    updateMatches()

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', updateMatches)
      return () => mediaQueryList.removeEventListener('change', updateMatches)
    }

    mediaQueryList.addListener(updateMatches)
    return () => mediaQueryList.removeListener(updateMatches)
  }, [query])

  return matches
}
