import { memo } from 'react'

interface AirspeedGaugeProps {
  value: number
  size?: number
}

/** Static bezel geometry, built once (see AltimeterGauge for the reasoning). */
const TICK_MARKS = Array.from({ length: 8 }, (_, i) => {
  const angle = (-135 + i * (270 / 7)) * (Math.PI / 180)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return (
    <line
      key={i}
      x1={50 + 30 * cos}
      y1={50 + 30 * sin}
      x2={50 + 38 * cos}
      y2={50 + 38 * sin}
      stroke="#6a7588"
      strokeWidth="1"
    />
  )
})

function AirspeedGaugeImpl({ value, size = 100 }: AirspeedGaugeProps) {
  const rotation = -135 + value * 270

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="45" fill="#1a2030" stroke="#4a5060" strokeWidth="2" />
      {TICK_MARKS}
      <text x="50" y="62" textAnchor="middle" fill="#8b95a8" fontSize="6" fontFamily="monospace">
        IAS
      </text>
      <g transform={`rotate(${rotation.toFixed(2)} 50 50)`}>
        <polygon points="50,20 47,50 50,46 53,50" fill="#ff4d4d" />
        <circle cx="50" cy="50" r="3" fill="#ff4d4d" />
      </g>
    </svg>
  )
}

export const AirspeedGauge = memo(AirspeedGaugeImpl)
