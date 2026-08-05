export const HORSE_RACE_LANES = [
  {
    id: 'standard',
    label: 'STANDARD',
    sideViewLabel: '標準速度の馬',
    frontViewLabel: '正面を向いた標準速度の馬',
  },
  {
    id: 'user',
    label: 'YOUR SPEED',
    sideViewLabel: 'あなたの回線速度の馬',
    frontViewLabel: '正面を向いたあなたの回線速度の馬',
  },
  {
    id: 'fast',
    label: 'FAST',
    sideViewLabel: '少し速い馬',
    frontViewLabel: '正面を向いた高速の馬',
  },
] as const

export type HorseId = typeof HORSE_RACE_LANES[number]['id']
