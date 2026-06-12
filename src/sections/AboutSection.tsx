import { lazy, Suspense, useEffect, useRef } from 'react'
import { portfolio } from '../data/portfolio'
import { useWaypointReached } from '../context/MissionContext'
import { RedactedHeading } from '../components/ui/RedactedHeading'
import { ScanWipe } from '../components/ui/ScanWipe'
import { TelemetryTicker } from '../components/ui/TelemetryTicker'
import { gsap } from '../lib/scrollTrigger'
import { useReducedMotion } from '../hooks/useReducedMotion'

import { sectionShellClass } from '../lib/waypointLayout'

const EarthOrbit = lazy(() =>
  import('../components/three/EarthOrbit').then((m) => ({ default: m.EarthOrbit })),
)

export function AboutSection() {
  const active = useWaypointReached('about')
  const schematicRef = useRef<SVGPathElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!active || !schematicRef.current || reduced) return
    const length = schematicRef.current.getTotalLength()
    gsap.fromTo(
      schematicRef.current,
      { strokeDashoffset: length },
      { strokeDashoffset: 0, duration: 2, ease: 'power2.inOut' },
    )
  }, [active, reduced])

  return (
    <section
      id="about"
      data-mission-waypoint
      data-waypoint-side="left"
      className={sectionShellClass('left')}
      aria-labelledby="about-heading"
    >
      <div className="section-inner wide grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="section-label">About</p>
          <div id="about-heading" className="mb-6">
            <RedactedHeading active={active}>About me</RedactedHeading>
          </div>
          <ScanWipe active={active}>
            <p className="text-[var(--color-text-muted)] text-lg leading-relaxed mb-6">
              {portfolio.about.bio}
            </p>
            <p className="text-sm text-slate-400 leading-relaxed mb-6 border-l-2 border-indigo-500/30 pl-4">
              {portfolio.about.missionStatement}
            </p>
            <ul className="space-y-3 mb-8">
              {portfolio.about.highlights.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-[var(--color-aluminum)] text-sm"
                >
                  <span className="text-[var(--color-cockpit-amber)] mt-1">▸</span>
                  {item}
                </li>
              ))}
            </ul>
            <blockquote className="mb-8 border-l-2 border-[var(--color-cockpit-amber)]/40 pl-4">
              <p className="text-slate-300 italic text-sm m-0">
                &ldquo;{portfolio.identity.quote.text}&rdquo;
              </p>
              <footer className="text-xs text-slate-500 mt-2">
                — {portfolio.identity.quote.attribution}
              </footer>
            </blockquote>
            <TelemetryTicker />
          </ScanWipe>
        </div>

        <div className="relative space-y-6">
          <div className="glass-card overflow-hidden max-w-sm mx-auto lg:mx-0 lg:ml-auto">
            <img
              src={portfolio.identity.portrait}
              alt={`Portrait of ${portfolio.identity.name}`}
              className="w-full h-auto object-cover aspect-[4/5]"
              loading="lazy"
            />
            <div className="px-4 py-3 border-t border-white/[0.06]">
              <p className="text-sm text-white font-medium m-0">{portfolio.identity.name}</p>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                {portfolio.identity.school} · {portfolio.identity.location}
              </p>
            </div>
          </div>
          <Suspense fallback={<div className="h-[300px]" />}>
            <EarthOrbit className="h-[300px] md:h-[350px]" />
          </Suspense>
          <svg
            className="absolute -bottom-8 -left-4 w-48 h-48 opacity-30"
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            <path
              ref={schematicRef}
              d="M 10 50 L 30 45 L 50 20 L 70 45 L 90 50 L 70 55 L 50 80 L 30 55 Z"
              fill="none"
              stroke="var(--color-cockpit-amber)"
              strokeWidth="0.5"
              strokeDasharray="200"
              strokeDashoffset="200"
            />
          </svg>
        </div>
      </div>
    </section>
  )
}
