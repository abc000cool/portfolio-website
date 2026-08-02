import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { portfolio } from '../data/portfolio'
import { RedactedHeading } from '../components/ui/RedactedHeading'
import { ScanWipe } from '../components/ui/ScanWipe'
import { TelemetryTicker } from '../components/ui/TelemetryTicker'
import { useSectionReveal } from '../hooks/useSectionReveal'
import { gsap } from '../lib/scrollTrigger'
import { useReducedMotion } from '../hooks/useReducedMotion'

import { sectionShellClass } from '../lib/waypointLayout'

/**
 * Decorative orbit. This replaces a react-three-fiber wireframe globe that
 * pulled the whole three.js vendor chunk onto every device — including phones,
 * where it was the only consumer of it. Same reserved height, ~1kB of markup.
 */
function OrbitGraphic({ reduced }: { reduced: boolean }) {
  /**
   * Satellites pulse rather than orbit: animating opacity needs no SVG
   * transform-origin, which resolves inconsistently inside nested <g> rotations.
   */
  const beacon = (duration: number, delay: number) =>
    reduced
      ? {}
      : {
          animate: { opacity: [0.35, 1, 0.35] },
          transition: { duration, delay, repeat: Infinity, ease: 'easeInOut' as const },
        }

  return (
    <div
      className="h-[300px] md:h-[350px] flex items-center justify-center"
      aria-hidden="true"
    >
      <svg viewBox="0 0 200 200" className="h-full w-auto max-w-full">
        <defs>
          {/* userSpaceOnUse — the flat latitude lines have a zero-height bbox,
              which objectBoundingBox gradients refuse to paint. */}
          <linearGradient
            id="about-orbit-line"
            gradientUnits="userSpaceOnUse"
            x1="30"
            y1="30"
            x2="170"
            y2="170"
          >
            <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Globe */}
        <circle cx="100" cy="100" r="40" fill="none" stroke="url(#about-orbit-line)" strokeWidth="0.9" />
        <ellipse cx="100" cy="100" rx="14" ry="40" fill="none" stroke="url(#about-orbit-line)" strokeWidth="0.5" opacity="0.65" />
        <ellipse cx="100" cy="100" rx="30" ry="40" fill="none" stroke="url(#about-orbit-line)" strokeWidth="0.5" opacity="0.45" />
        <line x1="60" y1="100" x2="140" y2="100" stroke="url(#about-orbit-line)" strokeWidth="0.5" opacity="0.6" />
        <line x1="69" y1="79" x2="131" y2="79" stroke="url(#about-orbit-line)" strokeWidth="0.4" opacity="0.35" />
        <line x1="69" y1="121" x2="131" y2="121" stroke="url(#about-orbit-line)" strokeWidth="0.4" opacity="0.35" />

        {/* Orbit tracks */}
        <g transform="rotate(-20 100 100)">
          <ellipse
            cx="100"
            cy="100"
            rx="82"
            ry="30"
            fill="none"
            stroke="var(--color-cockpit-amber)"
            strokeWidth="0.6"
            strokeDasharray="3 5"
            opacity="0.45"
          />
          <motion.circle
            cx="182"
            cy="100"
            r="3"
            fill="var(--color-cockpit-amber)"
            {...beacon(3.2, 0)}
          />
          <motion.circle
            cx="18"
            cy="100"
            r="1.6"
            fill="var(--color-cockpit-amber)"
            {...beacon(3.2, 1.6)}
          />
        </g>

        <g transform="rotate(26 100 100)">
          <ellipse
            cx="100"
            cy="100"
            rx="64"
            ry="22"
            fill="none"
            stroke="url(#about-orbit-line)"
            strokeWidth="0.6"
            opacity="0.5"
          />
          <motion.circle cx="164" cy="100" r="2.2" fill="#c7d2fe" {...beacon(4.4, 0.8)} />
        </g>
      </svg>
    </div>
  )
}

export function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const active = useSectionReveal('about', sectionRef)
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
      ref={sectionRef}
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
            <ul className="space-y-3 mb-8">
              {portfolio.about.highlights.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-[var(--color-aluminum)] text-[0.9375rem] leading-relaxed"
                >
                  <span className="text-[var(--color-cockpit-amber)] mt-1 shrink-0" aria-hidden="true">
                    ▸
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-[var(--color-text-muted)] text-lg leading-relaxed mb-6">
              {portfolio.about.bio}
            </p>
            <p className="text-sm text-slate-400 leading-relaxed mb-6 border-l-2 border-indigo-500/30 pl-4">
              {portfolio.about.missionStatement}
            </p>
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
          <OrbitGraphic reduced={reduced} />
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
