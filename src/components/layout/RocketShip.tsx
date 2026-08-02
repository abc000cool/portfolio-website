interface RocketShipProps {
  className?: string
}

/**
 * The rocket moves on every scroll tick, so nothing on it may be filtered:
 * a `feDropShadow` on a transforming group re-rasterizes the whole subtree
 * each frame. The shadow is a flat dark underlay instead.
 */
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
      </defs>

      <ellipse cx="0" cy="14" rx="5" ry="8" fill="url(#exhaust-glow)" opacity="0.7" />

      {/* Contact shadow: one extra fill, no filter region to re-rasterize. */}
      <path
        d="M 0 -19 L 6.5 7 L 6.5 19 L -6.5 19 L -6.5 7 Z"
        fill="#06060a"
        opacity="0.4"
        transform="translate(0.6 1.6)"
      />

      <g>
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
