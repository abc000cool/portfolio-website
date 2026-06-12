interface AirspeedGaugeProps {
  value: number
  size?: number
}

export function AirspeedGauge({ value, size = 100 }: AirspeedGaugeProps) {
  const rotation = -135 + value * 270

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="45" fill="#1a2030" stroke="#4a5060" strokeWidth="2" />
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (-135 + i * (270 / 7)) * (Math.PI / 180)
        const x1 = 50 + 30 * Math.cos(angle)
        const y1 = 50 + 30 * Math.sin(angle)
        const x2 = 50 + 38 * Math.cos(angle)
        const y2 = 50 + 38 * Math.sin(angle)
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6a7588" strokeWidth="1" />
        )
      })}
      <text x="50" y="62" textAnchor="middle" fill="#8b95a8" fontSize="6" fontFamily="monospace">
        IAS
      </text>
      <g transform={`rotate(${rotation} 50 50)`}>
        <polygon points="50,20 47,50 50,46 53,50" fill="#ff4d4d" />
        <circle cx="50" cy="50" r="3" fill="#ff4d4d" />
      </g>
    </svg>
  )
}
