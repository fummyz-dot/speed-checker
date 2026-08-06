import type { RaceLane } from '../lib/horseRaceLanes'

interface RunnerFrontViewProps {
  lane: RaceLane
}

const RunnerFace = ({ id }: { id: RaceLane['id'] }) => {
  if (id === 'standard') {
    return (
      <g className="runner-face runner-face--standard" data-runner-face="standard">
        <ellipse className="runner-face__ear" cx="22.5" cy="12" rx="2" ry="3" />
        <ellipse className="runner-face__ear" cx="41.5" cy="12" rx="2" ry="3" />
        <ellipse className="runner-face__shape" cx="32" cy="12" rx="9.5" ry="10" />
        <path className="runner-face__hair" d="M22.5 10C23 2 27 1 32 1.5c5 .5 8 3 9.5 8.5-4-2-7-3-10-2-3-2-6-1-9 2Z" />
        <path className="runner-face__brow" d="m26.5 10 3-.4m5 0 3 .4" />
        <circle className="runner-face__eye" cx="28" cy="12.5" r="1" />
        <circle className="runner-face__eye" cx="36" cy="12.5" r="1" />
        <path className="runner-face__mouth" d="M29 17q3 2 6 0" />
      </g>
    )
  }

  if (id === 'fast') {
    return (
      <g className="runner-face runner-face--fast" data-runner-face="fast">
        <circle className="runner-face__ear" cx="22.5" cy="12" r="2" />
        <circle className="runner-face__ear" cx="41.5" cy="12" r="2" />
        <path className="runner-face__shape" d="M23 7Q32-1 41 7l-1.5 10Q32 24 24.5 17L23 7Z" />
        <path className="runner-face__hair" d="m22.5 9 2-7 4 3 4-5 3.5 4 5-2 .5 7-5-2-4.5 1-4-1-4.5 2Z" />
        <path className="runner-face__brow" d="m26 10 4 1m4 0 4-1" />
        <path className="runner-face__eye runner-face__eye--line" d="m27 13 3 .3m4-.3 3-.3" />
        <path className="runner-face__mouth" d="M29 18q3 1 6-.5" />
      </g>
    )
  }

  return (
    <g className="runner-face runner-face--user" data-runner-face="user">
      <ellipse className="runner-face__ear" cx="22" cy="12" rx="2" ry="3" />
      <ellipse className="runner-face__ear" cx="42" cy="12" rx="2" ry="3" />
      <ellipse className="runner-face__shape" cx="32" cy="12" rx="10" ry="10.5" />
      <path className="runner-face__hair" d="M22 9C23 1 29 0 34 1c4 .5 7 3 8 8-5-3-8-3-11-1 1-2 1-3 0-4-2 3-5 4-9 5Z" />
      <path className="runner-face__brow" d="m26 10 4-.5m4 .5 4 .5" />
      <circle className="runner-face__eye" cx="28" cy="12.5" r="1.15" />
      <circle className="runner-face__eye" cx="36" cy="12.5" r="1.15" />
      <path className="runner-face__mouth runner-face__mouth--smile" d="M28.5 16.5q3.5 4 7 0" />
    </g>
  )
}

const FrontRunnerIcon = ({ id, label }: { id: RaceLane['id']; label: string }) => (
  <svg
    className={`runner-front-view runner-front-view--${id}`}
    viewBox="0 0 64 92"
    role="img"
    aria-label={label}
  >
    <RunnerFace id={id} />
    <path className="runner-front-view__torso" d="M24 24h16l4 32H20l4-32Z" />
    <g className="runner-front-view__arm runner-front-view__arm--left">
      <path d="M24 29 6 55" />
      <circle cx="6" cy="55" r="3.8" />
    </g>
    <g className="runner-front-view__arm runner-front-view__arm--right">
      <path d="m40 29 18 26" />
      <circle cx="58" cy="55" r="3.8" />
    </g>
    <g className="runner-front-view__leg runner-front-view__leg--left">
      <path d="m27 53-5 31" />
      <path d="m22 84-7 3" />
    </g>
    <g className="runner-front-view__leg runner-front-view__leg--right">
      <path d="m37 53 5 31" />
      <path d="m42 84 7 3" />
    </g>
  </svg>
)

export const RunnerFrontView = ({ lane }: RunnerFrontViewProps) => (
  <div
    className={`front-runner front-runner--${lane.id}`}
    data-front-runner={lane.id}
  >
    <div className="front-runner__stage">
      <span className="front-runner__shadow" />
      <div className="front-runner__jumper">
        <div className="front-runner__figure">
          <FrontRunnerIcon id={lane.id} label={lane.frontViewLabel} />
        </div>
      </div>
    </div>
    <span className="front-runner__label">{lane.label}</span>
  </div>
)
