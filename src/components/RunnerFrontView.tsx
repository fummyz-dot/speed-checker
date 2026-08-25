import type { RaceLane } from '../lib/horseRaceLanes'
import type { FrontViewJockeyExpression } from '../lib/horseVisualization'

interface RunnerFrontViewProps {
  expression: FrontViewJockeyExpression
  lane: RaceLane
  rank: 1 | 2 | 3
}

type FrontJockeyAssets = Record<1 | 2 | 3, string>

const FRONT_HORSE_ASSETS: Record<RaceLane['id'], string> = {
  standard: '/assets/horse/front/front-horse-standard.webp',
  user: '/assets/horse/front/front-horse-user.webp',
  fast: '/assets/horse/front/front-horse-fast.webp',
}

const FRONT_JOCKEY_ASSETS: Record<RaceLane['id'], FrontJockeyAssets> = {
  standard: {
    1: '/assets/horse/front/front-jockey-standard-rank1.webp',
    2: '/assets/horse/front/front-jockey-standard-rank2.webp',
    3: '/assets/horse/front/front-jockey-standard-rank3.webp',
  },
  user: {
    1: '/assets/horse/front/front-jockey-user-rank1.webp',
    2: '/assets/horse/front/front-jockey-user-rank2.webp',
    3: '/assets/horse/front/front-jockey-user-rank3.webp',
  },
  fast: {
    1: '/assets/horse/front/front-jockey-fast-rank1.webp',
    2: '/assets/horse/front/front-jockey-fast-rank2.webp',
    3: '/assets/horse/front/front-jockey-fast-rank3.webp',
  },
}

export const RunnerFrontView = ({ expression, lane, rank }: RunnerFrontViewProps) => (
  <div
    className={`front-unit front-runner front-runner--${lane.id}`}
    data-front-runner={lane.id}
    data-front-unit={lane.id}
  >
    <div className="front-runner__stage">
      <span className="front-runner__shadow" />
      <img
        alt=""
        aria-hidden="true"
        className="front-horse"
        data-front-horse={lane.id}
        src={FRONT_HORSE_ASSETS[lane.id]}
      />
      <div className="front-jockey-jumper">
        <img
          alt={lane.frontViewLabel}
          className="front-jockey-image"
          data-front-expression={expression}
          data-front-jockey={lane.id}
          data-upload-rank={rank}
          src={FRONT_JOCKEY_ASSETS[lane.id][rank]}
        />
      </div>
    </div>
    <span className="front-runner__label">{lane.label}</span>
  </div>
)
