import type { HorseRaceState } from '../hooks/useHorseRaceAnimation'
import { HORSE_RACE_LANES } from '../lib/horseRaceLanes'

interface GoalFocusFrontViewProps {
  state: HorseRaceState
}

interface FrontHorseIconProps {
  label: string
}

const FrontHorseIcon = ({ label }: FrontHorseIconProps) => (
  <svg viewBox="0 0 72 88" role="img" aria-label={label}>
    <path className="front-horse-icon__mane" d="M34 15c-8 5-12 14-11 28l5 10 8-6 7-20-9-12Z" />
    <path d="m25 20-11-12 2 22 10 3M47 20 58 8l-2 22-10 3" />
    <path d="M36 12c-12 0-19 12-17 29 1 12 7 21 17 21s16-9 17-21c2-17-5-29-17-29Z" />
    <path className="front-horse-icon__blaze" d="m36 16-4 20 4 15 4-15-4-20Z" />
    <path d="M24 53C15 59 13 70 14 84h13l3-19h12l3 19h13c1-14-1-25-10-31-4 6-20 6-24 0Z" />
    <path className="front-horse-icon__muzzle" d="M26 47c0 9 4 14 10 14s10-5 10-14c-5-4-15-4-20 0Z" />
    <circle cx="28" cy="37" r="2" />
    <circle cx="44" cy="37" r="2" />
    <circle cx="32" cy="52" r="1.4" />
    <circle cx="40" cy="52" r="1.4" />
  </svg>
)

const frontViewStates: HorseRaceState[] = [
  'transitionToFrontView',
  'groupJumpFrontView',
  'finished',
]

export const GoalFocusFrontView = ({ state }: GoalFocusFrontViewProps) => {
  const isActive = frontViewStates.includes(state)

  return (
    <div
      className="goal-focus-front-view"
      data-front-view-active={isActive}
      aria-hidden={!isActive}
    >
      <div className="goal-focus-front-view__heading">
        <span>FRONT VIEW</span>
        <strong>GOAL</strong>
      </div>
      <div className="goal-focus-front-view__lineup">
        {HORSE_RACE_LANES.map((lane) => (
          <div
            className={`front-horse front-horse--${lane.id}`}
            data-front-horse={lane.id}
            key={lane.id}
          >
            <div className="front-horse__stage">
              <span className="front-horse__shadow" />
              <div className="front-horse__jumper">
                <div className="front-horse__figure">
                  <FrontHorseIcon label={lane.frontViewLabel} />
                </div>
              </div>
            </div>
            <span className="front-horse__label">{lane.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
