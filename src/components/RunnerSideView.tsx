import type { HorseId } from '../lib/horseRaceLanes'

interface RunnerSideViewProps {
  id: HorseId
  label: string
}

export const RunnerSideView = ({ id, label }: RunnerSideViewProps) => (
  <svg
    className={`race-horse race-horse--${id}`}
    viewBox="0 0 180 112"
    role="img"
    aria-label={label}
  >
    <path className="race-horse__tail" d="M43 49C29 48 13 53 4 67c8-17 16-28 28-35-13-1-22-8-24-17 15 11 30 15 44 27Z" />
    <path className="race-horse__leg race-horse__leg--hind race-horse__leg--far race-horse__leg--hind-back" d="M58 64C53 77 43 90 29 100l-14 7 11 3 18-8c13-10 23-22 29-36Z" />
    <path className="race-horse__leg race-horse__leg--front race-horse__leg--far race-horse__leg--front-back" d="m116 64 16 20 19 18h-13l-19-14-16-17Z" />
    <path className="race-horse__body" d="M37 43c15-13 47-16 68-8 13 5 19 15 14 26-5 13-23 18-45 18H49c-16 0-27-7-30-19-2-7 5-13 18-17Z" />
    <path className="race-horse__body-shadow" d="M25 63c18 10 62 12 91-5-5 13-23 20-42 20H49c-13 0-21-5-24-15Z" />
    <path className="race-horse__neck" d="M104 54c4-18 12-32 25-41l17 12c-13 11-19 24-21 41Z" />
    <path className="race-horse__mane" d="M108 48c5-18 13-30 23-38l6 6-6 6 9 2-8 6 8 3-9 6 6 4-12 6Z" />
    <path className="race-horse__head" d="M128 15c11-7 25-3 36 6 9 7 12 15 8 24l-8 8-16-1-12-8-7-13Z" />
    <path className="race-horse__muzzle" d="m159 31 14-1 5 7-2 10-9 6-12-2Z" />
    <path className="race-horse__ear" d="m135 16 2-7 5 9Z" />
    <circle className="race-horse__eye" cx="151" cy="25" r="1.8" />
    <path className="race-horse__bridle" d="m139 18 22 31m-25-5 29 3m-16-20 22 7" />
    <path className="race-horse__leg race-horse__leg--hind race-horse__leg--near race-horse__leg--hind-front" d="M69 73c0 13 5 23 15 33l12 3-4-7-10-12-2-18Z" />
    <path className="race-horse__leg race-horse__leg--front race-horse__leg--near race-horse__leg--front-forward" d="m111 70 11 16 15 20 12 2-4-8-12-13-10-20Z" />
    <path className="race-horse__saddle" d="m70 46 30 2 10 11-36 4-11-9Z" />
    <g className="race-horse__jockey">
      <circle className="race-horse__jockey-head" cx="85" cy="17" r="6" />
      <path className="race-horse__jockey-cap" d="M79 15c3-7 10-7 13 0l-2 3H78Z" />
      <path className="race-horse__jockey-body" d="m78 25 15 3 10 14-11 9-15-12Z" />
      <path className="race-horse__jockey-arm" d="m96 31 19 7 19-7 3 5-22 11-21-8Z" />
      <path className="race-horse__jockey-leg" d="m96 47 15 6 9 14-9 1-12-13-15-4Z" />
    </g>
    <path className="race-horse__number-cloth" d="m75 57 23-3 5 14-23 4Z" />
    <text className="race-horse__number" x="89" y="66.5" textAnchor="middle">{id === 'standard' ? '3' : id === 'user' ? '1' : '7'}</text>
    <path className="race-horse__hoof race-horse__hoof--hind" d="M15 107h11m58 1h12" />
    <path className="race-horse__hoof race-horse__hoof--front" d="M138 102h13m-13 6h12" />
  </svg>
)
