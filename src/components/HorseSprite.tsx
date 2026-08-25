import type { HorseId } from '../lib/horseRaceLanes'

const HORSE_SPRITE_ASSETS = {
  standard: {
    gallop: '/assets/horse/horse-standard-gallop.webp',
    idle: '/assets/horse/horse-standard-idle.webp',
  },
  user: {
    gallop: '/assets/horse/horse-user-gallop.webp',
    idle: '/assets/horse/horse-user-idle.webp',
  },
  fast: {
    gallop: '/assets/horse/horse-fast-gallop.webp',
    idle: '/assets/horse/horse-fast-idle.webp',
  },
} as const satisfies Record<HorseId, { gallop: string, idle: string }>

interface HorseSpriteProps {
  id: HorseId
  label: string
  isGalloping: boolean
}

export const HorseSprite = ({ id, label, isGalloping }: HorseSpriteProps) => {
  const assets = HORSE_SPRITE_ASSETS[id]

  return (
    <div
      className={`horse-sprite horse-sprite--${id} ${isGalloping ? 'horse-sprite--galloping' : 'horse-sprite--static'}`}
      role="img"
      aria-label={label}
      data-horse-sprite={id}
      data-sprite-src={assets.gallop}
      data-idle-src={assets.idle}
    />
  )
}
