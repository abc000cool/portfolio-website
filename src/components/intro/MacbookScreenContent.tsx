import { useState } from 'react'
import { useMotionValue, useMotionValueEvent, type MotionValue } from 'motion/react'
import { portfolio } from '../../data/portfolio'

const CHART_POINTS = '0,38 14,34 28,30 42,31 56,24 70,20 84,14 100,10'

interface MacbookScreenContentProps {
  progress?: MotionValue<number>
  compact?: boolean
  /** Scroll progress at which launch UI appears (lower on mobile). */
  launchAt?: number
}

export function MacbookScreenContent({
  progress,
  compact = false,
  launchAt,
}: MacbookScreenContentProps) {
  const fallback = useMotionValue(0)
  const [launch, setLaunch] = useState(false)
  const launchThreshold = launchAt ?? (compact ? 0.2 : 0.48)

  useMotionValueEvent(progress ?? fallback, 'change', (v) => {
    const next = v >= launchThreshold
    setLaunch((prev) => (prev === next ? prev : next))
  })

  if (compact) {
    return (
      <div className="relative h-full w-full bg-[#07070d] text-left overflow-hidden select-none">
        <div className="flex items-center gap-1 px-2 py-1 border-b border-white/[0.06] bg-[#0b0b13]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff5f57]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#febc2e]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#28c840]" />
          <span className="ml-1.5 text-[7px] text-slate-500 font-mono truncate">
            {launch ? 'launch active' : 'mission-control'}
          </span>
        </div>

        <div className="p-2.5 flex flex-col gap-2 h-[calc(100%-1.25rem)]">
          <div>
            <p className="text-[7px] uppercase tracking-widest text-indigo-400/90 mb-0.5">
              Mission dashboard
            </p>
            <h2 className="font-display text-[11px] text-white font-semibold leading-tight truncate">
              {portfolio.identity.name}
            </h2>
            <p className="text-[8px] text-slate-500 truncate">{portfolio.identity.title}</p>
          </div>

          <div className="flex-1 min-h-0 rounded border border-white/[0.06] bg-white/[0.02] p-1.5">
            <svg viewBox="0 0 100 42" preserveAspectRatio="none" className="w-full h-full">
              <defs>
                <linearGradient id="chart-fill-mobile" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={`0,42 ${CHART_POINTS} 100,42`} fill="url(#chart-fill-mobile)" />
              <polyline
                points={CHART_POINTS}
                fill="none"
                stroke="#a5b4fc"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {portfolio.stats.slice(0, 2).map((stat) => (
              <div
                key={stat.label}
                className="rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-1 text-center"
              >
                <p className="text-[9px] font-semibold text-white leading-none">
                  {stat.display ?? stat.value}
                </p>
                <p className="text-[6px] text-slate-500 mt-0.5 leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {launch && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center py-1 bg-indigo-600/25 border-t border-indigo-400/30">
            <span className="text-[7px] font-mono tracking-widest text-indigo-200 uppercase">
              Launch sequence
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative h-full w-full bg-[#07070d] text-left overflow-hidden select-none">
      {/* Menu bar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/[0.06] bg-[#0b0b13]">
        <span className="w-2 h-2 rounded-full bg-[#ff5f57]" />
        <span className="w-2 h-2 rounded-full bg-[#febc2e]" />
        <span className="w-2 h-2 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-[9px] text-slate-500 font-mono truncate">
          {launch
            ? 'launch-sequence — countdown active'
            : `mission-control — ${portfolio.identity.name.split(' ')[0].toLowerCase()}@flight-os`}
        </span>
      </div>

      {/* Dashboard */}
      <div className="p-4 h-[calc(100%-1.75rem)] grid grid-cols-5 gap-3">
        {/* Left column */}
        <div className="col-span-3 flex flex-col gap-3 min-h-0">
          <div>
            <p className="text-[9px] uppercase tracking-[0.22em] text-indigo-400/90 mb-1">
              Mission dashboard
            </p>
            <h2 className="font-display text-base md:text-lg text-white font-semibold leading-tight">
              {portfolio.identity.name}
            </h2>
            <p className="text-[10px] text-slate-500">{portfolio.identity.title}</p>
          </div>

          {/* Telemetry chart */}
          <div className="flex-1 min-h-0 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[8px] uppercase tracking-widest text-slate-500">
                Altitude profile — flight 047
              </p>
              <span className="flex items-center gap-1 text-[8px] text-emerald-400">
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            </div>
            <svg viewBox="0 0 100 42" preserveAspectRatio="none" className="w-full h-[calc(100%-1.25rem)]">
              <defs>
                <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[10, 20, 30].map((y) => (
                <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#ffffff09" strokeWidth="0.4" />
              ))}
              <polygon points={`0,42 ${CHART_POINTS} 100,42`} fill="url(#chart-fill)" />
              <polyline
                points={CHART_POINTS}
                fill="none"
                stroke="#a5b4fc"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx="100" cy="10" r="1.6" fill="#c7d2fe" />
            </svg>
          </div>

          {/* Opportunities */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-2.5 py-2 min-h-[4.25rem] flex flex-col justify-center">
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <p className="text-[8px] uppercase tracking-widest text-emerald-300/90 m-0 text-center">
                Open for opportunities
              </p>
            </div>
            <p className="text-[10px] text-slate-300 text-center leading-snug m-0">
              Internships, research & collaboration
            </p>
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-2 flex flex-col gap-3 min-h-0">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            {portfolio.stats.slice(0, 4).map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-2 py-1.5 text-center flex flex-col items-center justify-center"
              >
                <p className="text-xs font-semibold text-white tabular-nums leading-tight">
                  {stat.display ?? stat.value}
                  {!stat.display && stat.suffix && (
                    <span className="text-[8px] text-slate-500 font-normal">{stat.suffix}</span>
                  )}
                </p>
                <p className="text-[7px] text-slate-500 mt-0.5 leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Orbit visual */}
          <div className="flex-1 min-h-0 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 flex items-center justify-center relative overflow-hidden">
            <svg viewBox="0 0 80 80" className="w-full h-full max-h-28">
              <circle cx="40" cy="40" r="10" fill="none" stroke="#818cf8" strokeWidth="0.8" opacity="0.9" />
              <circle cx="40" cy="40" r="10" fill="#6366f1" opacity="0.15" />
              <ellipse cx="40" cy="40" rx="26" ry="11" fill="none" stroke="#475569" strokeWidth="0.5" strokeDasharray="2 2" transform="rotate(-18 40 40)" />
              <ellipse cx="40" cy="40" rx="34" ry="15" fill="none" stroke="#334155" strokeWidth="0.4" strokeDasharray="1.5 2.5" transform="rotate(-18 40 40)" />
              <circle cx="62" cy="32" r="1.8" fill="#c7d2fe">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 40 40"
                  to="360 40 40"
                  dur="14s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx="14" cy="52" r="1.2" fill="#a5b4fc" opacity="0.7">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 40 40"
                  to="-360 40 40"
                  dur="22s"
                  repeatCount="indefinite"
                />
              </circle>
            </svg>
            <p className="absolute bottom-1.5 left-2.5 text-[7px] uppercase tracking-widest text-slate-600">
              Orbital sim
            </p>
          </div>

          {/* Disciplines */}
          <div className="flex flex-wrap gap-1">
            {portfolio.disciplines.slice(0, 4).map((d) => (
              <span
                key={d}
                className="text-[7px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-300"
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>

      {launch && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-2 py-1.5 bg-indigo-600/20 border-t border-indigo-400/30 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-ping" />
          <span className="text-[9px] font-mono tracking-[0.25em] text-indigo-200 uppercase">
            Launch sequence initiated
          </span>
        </div>
      )}

      {/* Screen sheen */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.01) 55%, transparent 60%)',
        }}
        aria-hidden="true"
      />
    </div>
  )
}
