import type { HorseId } from '../lib/horseRaceLanes'

interface RunnerSideViewProps {
  id: HorseId
  label: string
}

export const RunnerSideView = ({ id, label }: RunnerSideViewProps) => (
  <svg
    className={`runner-side-view runner-side-view--${id}`}
    viewBox="0 0 52 70"
    role="img"
    aria-label={label}
  >
    <circle className="runner-side-view__head" cx="34" cy="10" r="7" />
    <path className="runner-side-view__torso" d="M31 19 24 41" />
    <g className="runner-side-view__limb runner-side-view__left-arm">
      <path d="m30 23 10 10 8-8" />
    </g>
    <g className="runner-side-view__limb runner-side-view__right-arm">
      <path d="m29 24-11 7-7 9" />
    </g>
    <g className="runner-side-view__limb runner-side-view__left-leg">
      <path d="m24 40 12 12 11 7" />
    </g>
    <g className="runner-side-view__limb runner-side-view__right-leg">
      <path d="m24 40-8 14-11 7" />
    </g>
  </svg>
)
