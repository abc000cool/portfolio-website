interface ArtificialHorizonProps {
  pitch: number
  roll: number
  size?: number
}

export function ArtificialHorizon({ pitch, roll, size = 100 }: ArtificialHorizonProps) {
  const pitchOffset = pitch * 30

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="45" fill="#1a2030" stroke="#4a5060" strokeWidth="2" />
      <clipPath id="horizonClip">
        <circle cx="50" cy="50" r="40" />
      </clipPath>
      <g clipPath="url(#horizonClip)" transform={`rotate(${roll} 50 50)`}>
        <rect x="10" y={10 + pitchOffset} width="80" height="40" fill="#4a7cff" />
        <rect x="10" y={50 + pitchOffset} width="80" height="40" fill="#8B6914" />
        <line
          x1="10"
          y1={50 + pitchOffset}
          x2="90"
          y2={50 + pitchOffset}
          stroke="#fff"
          strokeWidth="1.5"
        />
        {[-20, -10, 0, 10, 20].map((offset) => (
          <line
            key={offset}
            x1="30"
            y1={50 + pitchOffset + offset}
            x2="70"
            y2={50 + pitchOffset + offset}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="0.5"
          />
        ))}
      </g>
      <line x1="50" y1="15" x2="50" y2="25" stroke="#ff4d4d" strokeWidth="2" />
      <polygon points="42,50 50,44 58,50" fill="#ff4d4d" />
    </svg>
  )
}
