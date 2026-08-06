import type { HorseRaceState } from '../hooks/useHorseRaceAnimation'
import { HORSE_RACE_LANES } from '../lib/horseRaceLanes'
import { RunnerFrontView } from './RunnerFrontView'

interface GoalFocusFrontViewProps {
  state: HorseRaceState
}

const frontViewStates: HorseRaceState[] = [
  'transitionToFrontView',
  'groupJumpFrontView',
  'finished',
]

const [standardLane, userLane, fastLane] = HORSE_RACE_LANES
const FRONT_VIEW_LANES = [fastLane, userLane, standardLane]

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
        {FRONT_VIEW_LANES.map((lane) => <RunnerFrontView lane={lane} key={lane.id} />)}
      </div>
    </div>
  )
}
