import { lazy, Suspense, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { portfolio } from '../data/portfolio'
import { RedactedHeading } from '../components/ui/RedactedHeading'
import { ScanWipe } from '../components/ui/ScanWipe'
import { TelemetryTicker } from '../components/ui/TelemetryTicker'
import { useSectionReveal } from '../hooks/useSectionReveal'
import { gsap } from '../lib/scrollTrigger'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useInView } from '../hooks/useInView'
import { useIsMobileLayout, useLightExperience } from '../hooks/useTouchDevice'

import { sectionShellClass } from '../lib/waypointLayout'

/**
 * Nested reveal offsets for the highlights list.
 *
 * Deliberately smaller than the shared revealHidden() offset: these items sit
 * inside a ScanWipe that is already carrying the whole block up 20px, and
 * nested translates add. A full second 20px on top would make the list travel
 * twice as far as the paragraph beside it.
 */
const listHidden = (light: boolean) => ({ opacity: 0, y: light ? 6 : 9 })
const LIST_VISIBLE = { opacity: 1, y: 0 }

const EarthOrbit = lazy(() =>
  import('../components/three/EarthOrbit').then((m) => ({ default: m.EarthOrbit })),
)

export function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const active = useSectionReveal('about', sectionRef)
  const schematicRef = useRef<SVGPathElement>(null)
  const reduced = useReducedMotion()
  const light = useLightExperience()
  const hiddenItem = listHidden(light)

  /*
   * The globe is 1.2 kB of geometry that drags in the ~880 kB three.js vendor
   * chunk. Below 1024px it is that chunk's only consumer on the whole page, so
   * phones downloaded and parsed all of it to draw three wireframe primitives.
   * Desktop keeps the globe but only mounts it once the section is near, so it
   * no longer competes with the intro animation for the main thread.
   */
  const orbitRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobileLayout()
  const orbitNear = useInView(orbitRef, { threshold: 0, rootMargin: '0px 0px 40% 0px' })
  const showOrbit = !isMobile && orbitNear

  /*
   * Draw-on for the schematic outline.
   *
   * The markup ships a hand-guessed strokeDasharray of 200 but the path is
   * ~210 units long, so the dash pattern repeated: the final ~10 units were
   * always gap and the outline never closed, whatever the animation did. The
   * real length is measured and written here instead.
   *
   * The tween is also parked behind the body copy rather than firing with it.
   * The schematic is decoration in the margin - it should be the last thing to
   * move in this section, not something competing with the paragraph text.
   */
  useEffect(() => {
    const path = schematicRef.current
    if (!path) return
    const length = path.getTotalLength()
    path.style.strokeDasharray = `${length}`

    if (reduced) {
      // Reduced motion gets the finished outline. Leaving the offset at its
      // markup value would strand the schematic permanently half-drawn.
      path.style.strokeDashoffset = '0'
      return
    }

    if (!active) {
      path.style.strokeDashoffset = `${length}`
      return
    }

    const tween = gsap.fromTo(
      path,
      { strokeDashoffset: length },
      { strokeDashoffset: 0, duration: 2, delay: 0.35, ease: 'power2.inOut' },
    )
    return () => {
      tween.kill()
    }
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
            <p className="text-[var(--color-text-muted)] text-lg leading-relaxed mb-6">
              {portfolio.about.bio}
            </p>
            <p className="text-sm text-slate-400 leading-relaxed mb-6 border-l-2 border-indigo-500/30 pl-4">
              {portfolio.about.missionStatement}
            </p>
            {/*
              * The highlights used to arrive as one slab with the rest of the
              * body copy. A list is read top to bottom, so it is given a short
              * decaying stagger that runs in that direction - the gaps start at
              * ~55ms and tighten, so the list settles instead of ticking, and
              * the whole run is capped at 0.22s no matter how many items the
              * data grows to. Element and classes are unchanged; this only adds
              * motion props.
              */}
            <ul className="space-y-3 mb-8">
              {portfolio.about.highlights.map((item, i) => (
                <motion.li
                  key={item}
                  initial={hiddenItem}
                  animate={active ? LIST_VISIBLE : hiddenItem}
                  transition={{
                    duration: 0.45,
                    delay: 0.14 + 0.22 * (1 - Math.exp(-i / 1.8)),
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="flex items-start gap-3 text-[var(--color-aluminum)] text-sm"
                >
                  <span className="text-[var(--color-cockpit-amber)] mt-1">▸</span>
                  {item}
                </motion.li>
              ))}
            </ul>
            <blockquote className="mb-8 border-l-2 border-[var(--color-cockpit-amber)]/40 pl-4">
              <p className="text-slate-300 italic text-sm m-0">
                &ldquo;{portfolio.identity.quote.text}&rdquo;
              </p>
              <footer className="text-xs text-slate-500 mt-2">
                - {portfolio.identity.quote.attribution}
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
          {/* Height is reserved whether or not the canvas mounts, so document
              height never changes mid-scroll - the flight path measures it. */}
          <div ref={orbitRef} className="h-[300px] md:h-[350px]">
            {showOrbit && (
              <Suspense fallback={<div className="h-full" />}>
                <EarthOrbit className="h-full" />
              </Suspense>
            )}
          </div>
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
