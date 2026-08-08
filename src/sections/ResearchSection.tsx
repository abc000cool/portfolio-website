import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useScroll } from 'motion/react'
import {
  RESEARCH_SHOWCASE,
  getResearchShowcasePaper,
  type ResearchShowcaseConfig,
  type ResearchViewerId,
} from '../data/researchShowcase'
import type { Paper } from '../data/portfolio'
import { RedactedHeading } from '../components/ui/RedactedHeading'
import { ScanWipe } from '../components/ui/ScanWipe'
import { ResearchViewerFrame } from '../components/research/ResearchViewerFrame'
import { sectionShellClass } from '../lib/waypointLayout'
import { scrollToSection } from '../lib/lenis'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useInView, prefetchResearchViewers } from '../hooks/useInView'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useIsMobileLayout } from '../hooks/useTouchDevice'
import { useSectionReveal } from '../hooks/useSectionReveal'

const MOBILE_SCROLL_SCALE = 0.55
const DEFAULT_SCROLL_HEIGHT_VH = 180

/**
 * Each scene's pacing comes from its own scrollHeightVh in researchShowcase.ts.
 * A viewer maps progress 0 to 1 across its zone, so shortening the zone makes
 * the same animation play proportionally faster. The data is authoritative and
 * there is no cap; the current values are deliberately short (about 0.55x the
 * originals) so every scene resolves within roughly two viewports of scroll -
 * tune per entry there, not here.
 */

/**
 * Mount the canvas well before the zone reaches the viewport. Mounting late
 * means the scene appears with progress already part-way through its timeline,
 * which reads as a glitch rather than a reveal, and it gives shaders no time to
 * compile off-screen.
 *
 * The margin is SYMMETRIC on purpose. A bottom-only margin looks ahead when
 * scrolling down but gives no lead at all when scrolling back up, because the
 * block then enters through the top edge - which is exactly why scrolling up
 * produced late mounts and frozen scenes.
 */
const VIEWER_MOUNT_OBSERVER: IntersectionObserverInit = {
  threshold: 0,
  // Three viewports of lead on both sides: chunks fetch and shaders compile
  // long before arrival, so a scene is already drawing when it scrolls in.
  rootMargin: '300% 0px 300% 0px',
}
/**
 * Drives the frameloop. Also symmetric: while a viewer is inactive its Canvas
 * sits on frameloop="demand" and holds whatever frame it last drew, so coming
 * back up into a block with no lead margin showed a stale frame that then
 * jumped to the current scroll position in one step.
 */
const VIEWER_ACTIVE_OBSERVER: IntersectionObserverInit = {
  threshold: 0,
  rootMargin: '40% 0px 40% 0px',
}

/** Frame to park each viewer on when scroll scrubbing is unavailable. */
const STATIC_PROGRESS: Record<ResearchViewerId, number> = {
  airfoil: 0.94,
  debris: 0.68,
  flowstate: 0.94,
  qcin: 0.98,
  sailnko: 0.62,
  transition: 0.93,
  nozzlemoc: 0.9,
  eilj2: 0.55,
  bli: 0.92,
  rde: 0.78,
}

const PRIMARY_ACTION_CLASS =
  'inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-mono text-xs uppercase tracking-widest text-white bg-indigo-500/20 border border-indigo-400/40 hover:bg-indigo-500/30 transition-colors no-underline'
const SECONDARY_ACTION_CLASS =
  'link-underline text-sm font-medium text-slate-400 hover:text-white no-underline'

const MorphingAirfoil = lazy(() =>
  import('../components/three/MorphingAirfoil').then((m) => ({ default: m.MorphingAirfoil })),
)
const SpaceDebrisOrbit = lazy(() =>
  import('../components/three/SpaceDebrisOrbit').then((m) => ({ default: m.SpaceDebrisOrbit })),
)
const FlowStateTraffic = lazy(() =>
  import('../components/three/FlowStateTraffic').then((m) => ({ default: m.FlowStateTraffic })),
)
const HybridQuantumNav = lazy(() =>
  import('../components/three/HybridQuantumNav').then((m) => ({ default: m.HybridQuantumNav })),
)
const SolarSailNKO = lazy(() =>
  import('../components/three/SolarSailNKO').then((m) => ({ default: m.SolarSailNKO })),
)
const TransitionAtlas = lazy(() =>
  import('../components/three/TransitionAtlas').then((m) => ({ default: m.TransitionAtlas })),
)
const NozzleMoc = lazy(() =>
  import('../components/three/NozzleMoc').then((m) => ({ default: m.NozzleMoc })),
)
const FormationKeeping = lazy(() =>
  import('../components/three/FormationKeeping').then((m) => ({ default: m.FormationKeeping })),
)
const BliBenefit = lazy(() =>
  import('../components/three/BliBenefit').then((m) => ({ default: m.BliBenefit })),
)
const RdeAtlas = lazy(() =>
  import('../components/three/RdeAtlas').then((m) => ({ default: m.RdeAtlas })),
)

const VIEWER_HEIGHT = 'h-[300px] md:h-[380px] lg:h-[420px]'

/**
 * Section copy uses the short `summary` when the data provides one and falls back
 * to the abstract. The detail pages keep the full abstract.
 * Written so it compiles whether or not `summary` exists on Paper yet.
 */
function paperBlurb(paper: Paper): string {
  const withSummary = paper as Paper & { summary?: string }
  return withSummary.summary ?? paper.abstract
}

function ViewerPlaceholder({ viewer }: { viewer: ResearchViewerId }) {
  return (
    <ResearchViewerFrame className={`${VIEWER_HEIGHT} research-viewer--${viewer}`}>
      {null}
    </ResearchViewerFrame>
  )
}

function ResearchViewer({
  config,
  mounted,
  active,
  scrollProgress,
  staticProgress = 0,
}: {
  config: ResearchShowcaseConfig
  mounted: boolean
  active: boolean
  scrollProgress?: ReturnType<typeof useScroll>['scrollYProgress']
  staticProgress?: number
}) {
  const viewer = config.viewer
  if (!viewer) return null

  const placeholder = <ViewerPlaceholder viewer={viewer} />

  return (
    <>
      {mounted ? (
        <Suspense fallback={placeholder}>
          {(() => {
            switch (viewer) {
              case 'debris':
                return (
                  <SpaceDebrisOrbit
                    progress={scrollProgress}
                    scrollProgress={staticProgress}
                    active={active}
                    className={VIEWER_HEIGHT}
                    showConferenceBadge={false}
                  />
                )
              case 'airfoil':
                return (
                  <MorphingAirfoil
                    variant="featured"
                    progress={scrollProgress}
                    scrollProgress={staticProgress}
                    active={active}
                    className={VIEWER_HEIGHT}
                  />
                )
              case 'flowstate':
                return (
                  <FlowStateTraffic
                    progress={scrollProgress}
                    scrollProgress={staticProgress}
                    active={active}
                    className={VIEWER_HEIGHT}
                  />
                )
              case 'qcin':
                return (
                  <HybridQuantumNav
                    progress={scrollProgress}
                    scrollProgress={staticProgress}
                    active={active}
                    className={VIEWER_HEIGHT}
                  />
                )
              case 'sailnko':
                return (
                  <SolarSailNKO
                    progress={scrollProgress}
                    scrollProgress={staticProgress}
                    active={active}
                    className={VIEWER_HEIGHT}
                  />
                )
              case 'transition':
                return (
                  <TransitionAtlas
                    progress={scrollProgress}
                    scrollProgress={staticProgress}
                    active={active}
                    className={VIEWER_HEIGHT}
                  />
                )
              case 'nozzlemoc':
                return (
                  <NozzleMoc
                    progress={scrollProgress}
                    scrollProgress={staticProgress}
                    active={active}
                    className={VIEWER_HEIGHT}
                  />
                )
              case 'eilj2':
                return (
                  <FormationKeeping
                    progress={scrollProgress}
                    scrollProgress={staticProgress}
                    active={active}
                    className={VIEWER_HEIGHT}
                  />
                )
              case 'bli':
                return (
                  <BliBenefit
                    progress={scrollProgress}
                    scrollProgress={staticProgress}
                    active={active}
                    className={VIEWER_HEIGHT}
                  />
                )
              case 'rde':
                return (
                  <RdeAtlas
                    progress={scrollProgress}
                    scrollProgress={staticProgress}
                    active={active}
                    className={VIEWER_HEIGHT}
                  />
                )
            }
          })()}
        </Suspense>
      ) : (
        placeholder
      )}
      {config.viewerHint && (
        <p className="research-showcase__viewer-hint font-mono text-[10px] uppercase tracking-widest text-slate-500 text-center mt-3">
          {config.viewerHint}
        </p>
      )}
    </>
  )
}

/**
 * Primary action is the thing the visitor cannot already see: a live site or the
 * source. The detail-page link stays available, demoted to a text link, because
 * it mostly reprints the paragraph above it.
 */
function ResearchActions({
  config,
  className = '',
}: {
  config: ResearchShowcaseConfig
  className?: string
}) {
  const primaryHref = config.externalUrl ?? config.githubUrl

  if (!primaryHref) {
    return (
      <div className={`flex flex-wrap items-center gap-x-5 gap-y-3 ${className}`}>
        <Link to={config.linkTo} className={PRIMARY_ACTION_CLASS}>
          {config.linkLabel}
        </Link>
      </div>
    )
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-3 ${className}`}>
      <a
        href={primaryHref}
        target="_blank"
        rel="noopener noreferrer"
        className={PRIMARY_ACTION_CLASS}
      >
        {config.externalUrl ? 'Open live site →' : 'View the code →'}
      </a>
      {config.externalUrl && config.githubUrl && (
        <a
          href={config.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={SECONDARY_ACTION_CLASS}
        >
          GitHub →
        </a>
      )}
      <Link to={config.linkTo} className={SECONDARY_ACTION_CLASS}>
        {config.linkLabel}
      </Link>
    </div>
  )
}

function ResearchMetrics({ config }: { config: ResearchShowcaseConfig }) {
  return (
    <div
      className={`research-showcase__metrics${config.metrics.length === 4 ? ' research-showcase__metrics--quad' : ''}`}
    >
      {config.metrics.map((metric) => (
        <div key={metric.label} className="research-showcase__metric">
          <span className="research-showcase__metric-value">{metric.value}</span>
          <span className="research-showcase__metric-label">{metric.label}</span>
        </div>
      ))}
    </div>
  )
}

/** Compact jump list so the ten entries are reachable without linear scrolling. */
function ResearchIndex({ reduced }: { reduced: boolean }) {
  const jump = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    // Reduced motion falls through to the native hash jump (scroll-behavior: auto).
    if (reduced) return
    event.preventDefault()
    scrollToSection(id)
  }

  return (
    <nav aria-label="Research index" className="glass-card overflow-hidden mb-10 md:mb-14">
      <p className="px-5 md:px-6 pt-4 pb-3 m-0 font-mono text-[10px] uppercase tracking-widest text-slate-500">
        Index
      </p>
      <ul className="list-none m-0 p-0">
        {RESEARCH_SHOWCASE.map((config) => {
          const paper = getResearchShowcasePaper(config.paperSlug)
          if (!paper) return null
          const headline = config.metrics[0]

          return (
            <li
              key={config.id}
              className="border-t border-white/[0.06] px-5 md:px-6 py-4 grid gap-2 md:gap-6 md:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)_auto] md:items-center"
            >
              <div className="min-w-0">
                <a
                  href={`#${config.id}`}
                  onClick={(event) => jump(event, config.id)}
                  className="link-underline font-display text-sm md:text-[0.95rem] text-white no-underline leading-snug"
                >
                  {paper.title}
                </a>
                <p className="m-0 mt-1 font-mono text-[11px] text-slate-500">
                  {paper.year} - {paper.venue}
                </p>
              </div>

              {headline && (
                <p className="m-0 text-xs leading-snug">
                  <span className="font-display text-sm text-[var(--color-accent-soft)]">
                    {headline.value}
                  </span>{' '}
                  <span className="text-slate-500">{headline.label}</span>
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-widest md:justify-end">
                <Link
                  to={config.linkTo}
                  className="link-underline text-slate-400 hover:text-white no-underline"
                >
                  Read
                </Link>
                {config.externalUrl && (
                  <a
                    href={config.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-underline text-slate-400 hover:text-white no-underline"
                  >
                    Live site
                  </a>
                )}
                {config.githubUrl && (
                  <a
                    href={config.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-underline text-slate-400 hover:text-white no-underline"
                  >
                    Code
                  </a>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function MobileResearchCard({ config }: { config: ResearchShowcaseConfig }) {
  const paper = getResearchShowcasePaper(config.paperSlug)
  if (!paper) return null

  return (
    <article
      id={config.id}
      className="glass-card p-6"
      aria-labelledby={`${config.id}-title`}
    >
      {config.conferenceBadge && (
        <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300/80 mb-3">
          {config.conferenceBadge.conference} {config.conferenceBadge.number} ·{' '}
          {config.conferenceBadge.location}
        </p>
      )}
      <span className="font-mono text-xs text-[var(--color-cockpit-amber)]">
        {paper.year} - {paper.venue}
      </span>
      <h3
        id={`${config.id}-title`}
        className="font-display text-lg text-white mt-2 mb-3 leading-snug"
      >
        {paper.title}
      </h3>
      <p className="text-sm text-slate-400 leading-relaxed mb-5 line-clamp-4">
        {paperBlurb(paper)}
      </p>
      <ResearchMetrics config={config} />
      <ResearchActions config={config} className="mt-6" />
    </article>
  )
}

function ResearchShowcaseBlock({
  config,
  headingActive,
  index,
}: {
  config: ResearchShowcaseConfig
  headingActive: boolean
  index: number
}) {
  const paper = getResearchShowcasePaper(config.paperSlug)
  const blockRef = useRef<HTMLDivElement>(null)
  const scrollZoneRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const blockInView = useInView(scrollZoneRef, VIEWER_ACTIVE_OBSERVER)
  const blockActive = headingActive || blockInView
  const hasViewer = Boolean(config.viewer)

  // Gate the MOUNT, not just the frameloop: a <Canvas> in the tree is a live
  // WebGL context + compiled shaders even when it never draws.
  //
  // The observer is attached to the block wrapper, not to the scroll zone: the
  // scroll zone only exists in the non-reduced-motion branch, and prefers-
  // reduced-motion visitors would otherwise get a permanently empty viewer.
  // It latches - once a viewer is mounted it stays mounted, because remounting
  // recompiles shaders and hitches on scroll-back.
  const [viewerMounted, setViewerMounted] = useState(false)
  useEffect(() => {
    const el = blockRef.current
    if (!el || !hasViewer || viewerMounted) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        setViewerMounted(true)
      },
      VIEWER_MOUNT_OBSERVER,
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasViewer, viewerMounted])

  const { scrollYProgress } = useScroll({
    target: scrollZoneRef,
    offset: ['start start', 'end end'],
  })

  if (!paper) return null

  const reverse = config.reverseLayout ?? index % 2 === 1
  const gridClass = reverse
    ? 'research-showcase__grid research-showcase__grid--reverse'
    : 'research-showcase__grid'
  const zoneScrollVh = config.scrollHeightVh ?? DEFAULT_SCROLL_HEIGHT_VH
  const scrollHeightVh = isMobile
    ? Math.round(zoneScrollVh * MOBILE_SCROLL_SCALE)
    : zoneScrollVh

  const card = (
    <article className="research-showcase__card glass-card p-6 md:p-8 lg:p-10">
      {config.conferenceBadge && (
        <div className="research-showcase__conference-card-badge" role="note">
          <span className="research-showcase__conference-card-kicker">Presented at</span>
          <span className="research-showcase__conference-card-title">
            {config.conferenceBadge.conference} {config.conferenceBadge.number}
          </span>
          <span className="research-showcase__conference-card-location">
            {config.conferenceBadge.location}
          </span>
        </div>
      )}

      <span className="font-mono text-xs text-[var(--color-cockpit-amber)]">
        {paper.year} - {paper.venue}
      </span>
      <h3
        id={`${config.id}-title`}
        className="font-display text-xl md:text-2xl text-white mt-3 mb-4 leading-snug tracking-tight"
      >
        {paper.title}
      </h3>
      <p className="text-sm text-slate-400 leading-relaxed mb-6">{paperBlurb(paper)}</p>

      <ResearchMetrics config={config} />

      <ResearchActions config={config} className="mt-8" />
    </article>
  )

  const staticProgress = config.viewer ? STATIC_PROGRESS[config.viewer] : 0

  const content = hasViewer ? (
    <div className={gridClass}>
      {card}
      <div className="research-showcase__viewer">
        <ResearchViewer
          config={config}
          mounted={viewerMounted}
          active={blockActive}
          scrollProgress={reduced ? undefined : scrollYProgress}
          staticProgress={reduced ? staticProgress : 0}
        />
      </div>
    </div>
  ) : (
    <div className="max-w-3xl">{card}</div>
  )

  return (
    <div
      ref={blockRef}
      id={config.id}
      className="research-showcase-block"
      aria-labelledby={`${config.id}-title`}
    >
      {!hasViewer || reduced ? (
        <div className="research-showcase__body">
          <ScanWipe active={headingActive}>{content}</ScanWipe>
        </div>
      ) : (
        // The spacer must stay mounted at its full vh height: missionPath.ts
        // measures container.scrollHeight with a ResizeObserver and re-measures
        // the flight path if the document height changes mid-scroll.
        <div
          ref={scrollZoneRef}
          className="research-showcase__scroll-zone"
          style={{ height: `${scrollHeightVh}vh` }}
        >
          <div className="research-showcase__sticky">
            <ScanWipe active={blockActive}>{content}</ScanWipe>
          </div>
        </div>
      )}
    </div>
  )
}

export function ResearchSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const active = useSectionReveal('research', sectionRef)
  const isMobile = useIsMobileLayout()
  const reduced = useReducedMotion()
  const sectionNear = useInView(sectionRef, VIEWER_ACTIVE_OBSERVER)

  useEffect(() => {
    if (sectionNear && !isMobile) prefetchResearchViewers()
  }, [sectionNear, isMobile])

  /*
   * Warm the viewer chunks during idle time instead of waiting until the
   * visitor arrives.
   *
   * Measured before this: zero chunk requests were made until the research
   * section came into view, at which point three.js, react-three-fiber and all
   * ten scenes were fetched and parsed at once - roughly a megabyte landing
   * exactly when the visitor expected to see something. requestIdleCallback
   * means this never competes with the intro animation, and the homepage is
   * long enough that the fetch has finished well before anyone scrolls down.
   */
  useEffect(() => {
    if (isMobile) return

    type NetworkInformation = { saveData?: boolean; effectiveType?: string }
    const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection
    // Do not spend someone's metered or slow connection on a decoration.
    if (conn?.saveData) return
    if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return

    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    const w = window as IdleWindow

    let cancelled = false
    const run = () => {
      if (!cancelled) prefetchResearchViewers()
    }

    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run, { timeout: 1500 })
      return () => {
        cancelled = true
        w.cancelIdleCallback?.(id)
      }
    }
    // Safari has no requestIdleCallback; a plain delay clears the intro.
    const id = window.setTimeout(run, 1200)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [isMobile])

  return (
    <section
      ref={sectionRef}
      id="research"
      data-mission-waypoint
      data-waypoint-side="left"
      className={sectionShellClass('left')}
      aria-labelledby="research-heading"
    >
      <div className="section-inner wide">
        <p className="section-label">Research</p>
        <div id="research-heading" className="mb-10 md:mb-14 max-w-2xl">
          <RedactedHeading active={active}>Research</RedactedHeading>
          <p className="text-slate-400 mt-4 leading-relaxed">
            {isMobile
              ? 'Research across orbital debris mitigation, morphing airfoils, traffic fluid dynamics, quantum–classical navigation, solar-sail orbits, laminar-flow transition, supersonic nozzle design, spacecraft formation-keeping, boundary-layer ingestion, and rotating detonation engines.'
              : 'Scroll through each project to explore interactive 3D visualizations - from orbital debris capture and solar sails hovering above the ecliptic to a nozzle drawn by the Method of Characteristics and detonation waves racing around a ring.'}
          </p>
        </div>

        <ResearchIndex reduced={reduced} />

        {isMobile ? (
          <ScanWipe active={active}>
            <div className="flex flex-col gap-6">
              {RESEARCH_SHOWCASE.map((config) => (
                <MobileResearchCard key={config.id} config={config} />
              ))}
            </div>
          </ScanWipe>
        ) : (
          <div className="research-showcase-list">
            {RESEARCH_SHOWCASE.map((config, index) => (
              <ResearchShowcaseBlock
                key={config.id}
                config={config}
                headingActive={active}
                index={index}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
