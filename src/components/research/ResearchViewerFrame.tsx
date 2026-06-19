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

        {hint && (
          <p className="research-viewer__hint font-mono text-[10px] uppercase tracking-widest text-slate-500 text-center">
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
