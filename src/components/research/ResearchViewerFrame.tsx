import type { ReactNode } from 'react'

export interface ResearchViewerFrameProps {
  className?: string
  children: ReactNode
  telemetry?: ReactNode
  legend?: ReactNode
  badge?: ReactNode
  progressPercent?: number
  hint?: string
}

export function ResearchViewerFrame({
  className = '',
  children,
  telemetry,
  legend,
  badge,
  progressPercent = 0,
  hint,
}: ResearchViewerFrameProps) {
  return (
    <div className={`research-viewer ${className}`} aria-hidden="true">
      <div className="research-viewer__frame">
        {children}

        {badge}

        {telemetry}

        <div className="research-viewer__morph-bar" aria-hidden="true">
          <div
            className="research-viewer__morph-bar-fill"
            style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
          />
        </div>

        {legend}

        {/*
          Interaction affordance, pinned top-left.

          In normal flow it landed on top of the legend and the phase read-out,
          which both live on the bottom edge. Only the airfoil viewer passes a
          hint today, and airfoil-viewer.css moves that viewer's telemetry panel
          to the top-RIGHT (.research-viewer--airfoil .research-viewer__telemetry),
          which leaves this corner free. If another viewer starts passing `hint`,
          check its telemetry corner first — the default panel is top-left.
        */}
        {hint && (
          <p className="absolute top-2 left-2 z-[3] m-0 max-w-[10.5rem] rounded-md border border-indigo-400/25 bg-black/80 px-2 py-1 font-mono text-[11px] leading-tight uppercase tracking-wider text-slate-300 pointer-events-none">
            {hint}
          </p>
        )}
      </div>
    </div>
  )
}

export function ConferenceBadgeOverlay({
  conference,
  number,
  location,
}: {
  conference: string
  number: string
  location: string
}) {
  return (
    <div className="research-viewer__conference-badge">
      <span className="research-viewer__conference-presented">Presented at</span>
      <span className="research-viewer__conference-title">
        {conference} {number}
      </span>
      <span className="research-viewer__conference-location">{location}</span>
    </div>
  )
}

export function ViewerTelemetry({
  label,
  rows,
}: {
  label: string
  rows: { key: string; value: string }[]
}) {
  return (
    <div className="research-viewer__telemetry">
      <p className="research-viewer__telemetry-label">{label}</p>
      <dl className="research-viewer__telemetry-grid">
        {rows.map((row) => (
          <div key={row.key}>
            <dt>{row.key}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
