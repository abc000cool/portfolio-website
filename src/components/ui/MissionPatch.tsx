import { useId } from 'react'

interface MissionPatchProps {
  title: string
  colors: [string, string, string]
  size?: number
}

/**
 * Deliberately static. The patch is an identity mark sitting inside cards that
 * already animate in as a group - giving it motion of its own would mean two
 * things arriving on different clocks in the same 64px square.
 */
export function MissionPatch({ title, colors, size = 80 }: MissionPatchProps) {
  const [outer, inner, accent] = colors

  // The projects grid renders one patch per project, and the stitch filter's id
  // was hardcoded - so every patch on the page declared id="stitch" and they
  // all resolved to whichever happened to be first in the DOM. Unmounting that
  // one (navigating away from the grid) left the rest pointing at a filter that
  // no longer existed, and every remaining ring visibly popped from jittered to
  // clean. Non-word characters are stripped because useId's output contains
  // delimiters that are awkward inside a url(#...) reference.
  const filterId = `stitch-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  const initials = title
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-label={`Mission patch: ${title}`}
      role="img"
    >
      <defs>
        <filter id={filterId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1" />
        </filter>
      </defs>
      <circle cx="50" cy="50" r="46" fill={outer} stroke={accent} strokeWidth="2" />
      <circle
        cx="50"
        cy="50"
        r="42"
        fill="none"
        stroke={inner}
        strokeWidth="1"
        strokeDasharray="3 2"
        filter={`url(#${filterId})`}
      />
      <circle cx="50" cy="50" r="35" fill={inner} opacity="0.3" />
      <text
        x="50"
        y="54"
        textAnchor="middle"
        fill={accent}
        fontSize="18"
        fontFamily="Rajdhani, sans-serif"
        fontWeight="700"
      >
        {initials}
      </text>
      <path
        d="M 50 8 L 52 14 L 50 12 L 48 14 Z"
        fill={accent}
        transform="rotate(0 50 50)"
      />
      <path
        d="M 50 8 L 52 14 L 50 12 L 48 14 Z"
        fill={accent}
        transform="rotate(72 50 50)"
      />
      <path
        d="M 50 8 L 52 14 L 50 12 L 48 14 Z"
        fill={accent}
        transform="rotate(144 50 50)"
      />
      <path
        d="M 50 8 L 52 14 L 50 12 L 48 14 Z"
        fill={accent}
        transform="rotate(216 50 50)"
      />
      <path
        d="M 50 8 L 52 14 L 50 12 L 48 14 Z"
        fill={accent}
        transform="rotate(288 50 50)"
      />
    </svg>
  )
}
