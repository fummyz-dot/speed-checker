export const HORSE_RACE_LANES = [
  {
    id: 'standard',
    label: '地方馬',
    sideViewLabel: '横向きに走る標準速度の競走馬',
    frontViewLabel: '正面で喜ぶ標準速度の騎手と競走馬',
  },
  {
    id: 'user',
    label: 'あなた',
    sideViewLabel: '横向きに走るあなたの回線速度の競走馬',
    frontViewLabel: '正面で喜ぶあなたの回線速度の騎手と競走馬',
  },
  {
    id: 'fast',
    label: '無敗の三冠馬',
    sideViewLabel: '横向きに走る高速の競走馬',
    frontViewLabel: '正面で喜ぶ高速の騎手と競走馬',
  },
] as const

export type HorseId = typeof HORSE_RACE_LANES[number]['id']
export type RaceLane = typeof HORSE_RACE_LANES[number]
