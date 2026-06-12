import { useEffect, useState } from 'react'

export function TelemetryTicker() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const missionElapsed = Math.floor((time.getTime() % 86400000) / 1000)
  const h = Math.floor(missionElapsed / 3600)
  const m = Math.floor((missionElapsed % 3600) / 60)
  const s = missionElapsed % 60

  return (
    <div
      className="flex flex-wrap gap-4 md:gap-8 font-mono text-xs text-[var(--color-text-muted)]"
      aria-live="polite"
    >
      <span>
        LAT <span className="text-[var(--color-cockpit-amber)]">33.1507°N</span>
      </span>
      <span>
        ALT <span className="text-[var(--color-cockpit-amber)]">248 SM</span>
      </span>
      <span>
        MET{' '}
        <span className="text-[var(--color-cockpit-amber)]">
          {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
        </span>
      </span>
    </div>
  )
}
