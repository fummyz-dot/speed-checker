import type { HorseRaceState } from '../hooks/useHorseRaceAnimation'
import { HORSE_RACE_LANES } from '../lib/horseRaceLanes'
import { getFrontViewUploadRanks } from '../lib/horseVisualization'
import { RunnerFrontView } from './RunnerFrontView'

interface GoalFocusFrontViewProps {
  state: HorseRaceState
  userUploadMbps: number | null
  championUploadMbps?: number
}

const frontViewStates: HorseRaceState[] = [
  'transitionToFrontView',
  'groupJumpFrontView',
  'finished',
]

const [standardLane, userLane, fastLane] = HORSE_RACE_LANES
const FRONT_VIEW_LANES = [fastLane, userLane, standardLane]

export const GoalFocusFrontView = ({
  state,
  userUploadMbps,
  championUploadMbps,
}: GoalFocusFrontViewProps) => {
  const isActive = frontViewStates.includes(state)
  const uploadRanks = getFrontViewUploadRanks(userUploadMbps, championUploadMbps)

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
        {FRONT_VIEW_LANES.map((lane) => (
          <RunnerFrontView
            expression={uploadRanks[lane.id].expression}
            lane={lane}
            rank={uploadRanks[lane.id].rank}
            key={lane.id}
          />
        ))}
      </div>
    </div>
  )
}
