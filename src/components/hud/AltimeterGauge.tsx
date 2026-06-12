interface AltimeterGaugeProps {
  value: number
  size?: number
}

export function AltimeterGauge({ value, size = 100 }: AltimeterGaugeProps) {
  const rotation = -135 + value * 270

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="45" fill="#1a2030" stroke="#4a5060" strokeWidth="2" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#3a4050" strokeWidth="1" />
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (-135 + i * 30) * (Math.PI / 180)
        const x1 = 50 + 32 * Math.cos(angle)
        const y1 = 50 + 32 * Math.sin(angle)
        const x2 = 50 + 38 * Math.cos(angle)
        const y2 = 50 + 38 * Math.sin(angle)
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8a919c" strokeWidth="1.5" />
        )
      })}
      <text x="50" y="62" textAnchor="middle" fill="#8b95a8" fontSize="7" fontFamily="monospace">
        ALT
      </text>
      <g transform={`rotate(${rotation} 50 50)`}>
        <line x1="50" y1="50" x2="50" y2="18" stroke="#e8a317" strokeWidth="2" strokeLinecap="round" />
        <circle cx="50" cy="50" r="4" fill="#e8a317" />
      </g>
    </svg>
  )
}
