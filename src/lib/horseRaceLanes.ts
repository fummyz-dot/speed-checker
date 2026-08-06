export const HORSE_RACE_LANES = [
  {
    id: 'standard',
    label: '地区優勝',
    sideViewLabel: '横向きに走る標準速度のランナー',
    frontViewLabel: '正面を向いた標準速度のランナー',
  },
  {
    id: 'user',
    label: 'あなた',
    sideViewLabel: '横向きに走るあなたの回線速度のランナー',
    frontViewLabel: '正面を向いたあなたの回線速度のランナー',
  },
  {
    id: 'fast',
    label: 'オリンピアン',
    sideViewLabel: '横向きに走る高速のランナー',
    frontViewLabel: '正面を向いた高速のランナー',
  },
] as const

export type HorseId = typeof HORSE_RACE_LANES[number]['id']
export type RaceLane = typeof HORSE_RACE_LANES[number]
