/** Defaults to false in every build unless the explicit preview variable is set. */
export const isRankingPreviewEnabled = (): boolean =>
  import.meta.env.VITE_RANKING_PREVIEW === 'true'
