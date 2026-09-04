export const isRankingEnabled = (): boolean => {
  const override = import.meta.env.VITE_RANKING_ENABLED
  if (override === 'true') return true
  if (override === 'false') return false
  return import.meta.env.PROD
}
