interface RocketShipProps {
  className?: string
}

export function RocketShip({ className = '' }: RocketShipProps) {
  return (
    <g className={className}>
      <defs>
        <linearGradient id="rocket-body" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#e8eaef" />
          <stop offset="45%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#c5cad4" />
        </linearGradient>
        <linearGradient id="rocket-nose" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#f1f5f9" />
        </linearGradient>
        <linearGradient id="rocket-fin" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <radialGradient id="exhaust-glow" cx="50%" cy="0%" r="80%">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#6366f1" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </radialGradient>
        <filter id="rocket-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>

      <ellipse cx="0" cy="14" rx="5" ry="8" fill="url(#exhaust-glow)" opacity="0.7" />

      <g filter="url(#rocket-shadow)">
        <path d="M -5 8 L -9 18 L -5 16 Z" fill="url(#rocket-fin)" />
        <path d="M 5 8 L 9 18 L 5 16 Z" fill="url(#rocket-fin)" />
        <path d="M 0 -18 L 5.5 6 L 0 4 L -5.5 6 Z" fill="url(#rocket-nose)" />
        <rect x="-4.5" y="4" width="9" height="12" rx="1" fill="url(#rocket-body)" />
        <rect x="-3.5" y="7" width="7" height="4" rx="1.5" fill="#1e293b" opacity="0.85" />
        <circle cx="0" cy="9" r="1.2" fill="#7dd3fc" opacity="0.8" />
        <rect x="-5" y="14" width="10" height="3" rx="0.5" fill="#475569" />
        <rect x="-3" y="17" width="6" height="2" rx="0.5" fill="#334155" />
      </g>
    </g>
  )
}
