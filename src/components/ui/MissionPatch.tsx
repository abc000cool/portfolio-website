interface MissionPatchProps {
  title: string
  colors: [string, string, string]
  size?: number
}

export function MissionPatch({ title, colors, size = 80 }: MissionPatchProps) {
  const [outer, inner, accent] = colors
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
        <filter id="stitch">
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
        filter="url(#stitch)"
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
