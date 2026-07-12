import { lazy, Suspense, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useScroll } from 'motion/react'
import {
  RESEARCH_SHOWCASE,
  getResearchShowcasePaper,
  type ResearchShowcaseConfig,
} from '../data/researchShowcase'
import { RedactedHeading } from '../components/ui/RedactedHeading'
import { ScanWipe } from '../components/ui/ScanWipe'
import { sectionShellClass } from '../lib/waypointLayout'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useInView, prefetchResearchViewers } from '../hooks/useInView'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useIsMobileLayout } from '../hooks/useTouchDevice'
import { useSectionReveal } from '../hooks/useSectionReveal'

const MOBILE_SCROLL_SCALE = 0.55

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

const VIEWER_HEIGHT = 'h-[300px] md:h-[380px] lg:h-[420px]'

function ResearchViewer({
  config,
  active,
  scrollProgress,
  staticProgress = 0,
}: {
  config: ResearchShowcaseConfig
  active: boolean
  scrollProgress?: ReturnType<typeof useScroll>['scrollYProgress']
  staticProgress?: number
}) {
  if (!config.viewer) return null

  const fallback =
    staticProgress ??
    (config.viewer === 'airfoil'
      ? 0.94
      : config.viewer === 'debris'
        ? 0.68
        : config.viewer === 'flowstate'
          ? 0.94
          : config.viewer === 'qcin'
            ? 0.98
            : config.viewer === 'sailnko'
              ? 0.62
              : config.viewer === 'transition'
                ? 0.93
                : 0.4)

  return (
    <Suspense fallback={<div className={`research-viewer ${VIEWER_HEIGHT}`} />}>
      {(() => {
        switch (config.viewer) {
          case 'debris':
            return (
              <SpaceDebrisOrbit
                progress={scrollProgress}
                scrollProgress={fallback}
                active={active}
                className={VIEWER_HEIGHT}
                showConferenceBadge
              />
            )
          case 'airfoil':
            return (
              <MorphingAirfoil
                variant="featured"
                progress={scrollProgress}
                scrollProgress={fallback}
                active={active}
                className={VIEWER_HEIGHT}
              />
            )
          case 'flowstate':
            return (
              <FlowStateTraffic
                progress={scrollProgress}
                scrollProgress={fallback}
                active={active}
                className={VIEWER_HEIGHT}
              />
            )
          case 'qcin':
            return (
              <HybridQuantumNav
                progress={scrollProgress}
                scrollProgress={fallback}
                active={active}
                className={VIEWER_HEIGHT}
              />
            )
          case 'sailnko':
            return (
              <SolarSailNKO
                progress={scrollProgress}
                scrollProgress={fallback}
                active={active}
                className={VIEWER_HEIGHT}
              />
            )
          case 'transition':
            return (
              <TransitionAtlas
                progress={scrollProgress}
                scrollProgress={fallback}
                active={active}
                className={VIEWER_HEIGHT}
              />
            )
        }
      })()}
      {config.viewerHint && (
        <p className="research-showcase__viewer-hint font-mono text-[10px] uppercase tracking-widest text-slate-500 text-center mt-3">
          {config.viewerHint}
        </p>
      )}
    </Suspense>
  )
}

function ResearchExternalLinks({ config }: { config: ResearchShowcaseConfig }) {
  if (!config.externalUrl && !config.githubUrl) return null
  return (
    <div className="flex flex-wrap items-center gap-4 mt-4">
      {config.externalUrl && (
        <a
          href={config.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="link-underline text-sm font-medium text-slate-400 hover:text-white no-underline"
        >
          Project site →
        </a>
      )}
      {config.githubUrl && (
        <a
          href={config.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="link-underline text-sm font-medium text-slate-400 hover:text-white no-underline"
        >
          GitHub →
        </a>
      )}
    </div>
  )
}

function MobileResearchCard({ config }: { config: ResearchShowcaseConfig }) {
  const paper = getResearchShowcasePaper(config.paperSlug)
  if (!paper) return null

  return (
    <article className="glass-card p-6">
      {config.conferenceBadge && (
        <p className="font-mono text-[10px] uppercase tracking-widest text-indigo-300/80 mb-3">
          {config.conferenceBadge.conference} {config.conferenceBadge.number} ·{' '}
          {config.conferenceBadge.location}
        </p>
      )}
      <span className="font-mono text-xs text-[var(--color-cockpit-amber)]">
        {paper.year} — {paper.venue}
      </span>
      <h3 className="font-display text-lg text-white mt-2 mb-3 leading-snug">{paper.title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed mb-5 line-clamp-4">{paper.abstract}</p>
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
      <Link
        to={config.linkTo}
        className="link-underline text-sm font-medium text-indigo-300 no-underline"
      >
        {config.linkLabel}
      </Link>
      <ResearchExternalLinks config={config} />
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
  const scrollZoneRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const blockInView = useInView(scrollZoneRef, { threshold: 0, rootMargin: '0px 0px 40% 0px' })
  const blockActive = headingActive || blockInView
  const hasViewer = Boolean(config.viewer)

  const { scrollYProgress } = useScroll({
    target: scrollZoneRef,
    offset: ['start start', 'end end'],
  })

  if (!paper) return null

  const reverse = config.reverseLayout ?? index % 2 === 1
  const gridClass = reverse
    ? 'research-showcase__grid research-showcase__grid--reverse'
    : 'research-showcase__grid'
  const scrollHeightVh = isMobile
    ? Math.round((config.scrollHeightVh ?? 180) * MOBILE_SCROLL_SCALE)
    : (config.scrollHeightVh ?? 180)

  const viewerActive = blockActive

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
        {paper.year} — {paper.venue}
      </span>
      <h3 className="font-display text-xl md:text-2xl text-white mt-3 mb-4 leading-snug tracking-tight">
        {paper.title}
      </h3>
      <p className="text-sm text-slate-400 leading-relaxed mb-6">{paper.abstract}</p>

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

      <Link
        to={config.linkTo}
        className="inline-flex items-center gap-2 mt-8 px-5 py-2.5 rounded-full font-mono text-xs uppercase tracking-widest text-white bg-indigo-500/20 border border-indigo-400/40 hover:bg-indigo-500/30 transition-colors no-underline"
      >
        {config.linkLabel}
      </Link>
      <ResearchExternalLinks config={config} />
    </article>
  )

  const reducedStatic =
    config.viewer === 'airfoil'
      ? 0.94
      : config.viewer === 'debris'
        ? 0.68
        : config.viewer === 'flowstate'
          ? 0.94
          : config.viewer === 'qcin'
            ? 0.98
            : config.viewer === 'sailnko'
              ? 0.62
              : config.viewer === 'transition'
                ? 0.93
                : 0.45

  const content = hasViewer ? (
    <div className={gridClass}>
      {card}
      <div className="research-showcase__viewer">
        <ResearchViewer
          config={config}
          active={viewerActive}
          scrollProgress={reduced ? undefined : scrollYProgress}
          staticProgress={reduced ? reducedStatic : 0}
        />
      </div>
    </div>
  ) : (
    <div className="max-w-3xl">{card}</div>
  )

  return (
    <div
      id={config.id}
      className="research-showcase-block"
      aria-labelledby={`${config.id}-title`}
    >
      {!hasViewer || reduced ? (
        <div className="research-showcase__body">
          <ScanWipe active={headingActive}>{content}</ScanWipe>
        </div>
      ) : (
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
  const sectionNear = useInView(sectionRef, {
    threshold: 0,
    rootMargin: '0px 0px 40% 0px',
  })

  useEffect(() => {
    if (sectionNear && !isMobile) prefetchResearchViewers()
  }, [sectionNear, isMobile])

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
              ? 'Research across orbital debris mitigation, morphing airfoil optimization, fluid-dynamics traffic modeling, hybrid quantum–classical inertial navigation, solar-sail non-Keplerian orbits, and boundary-layer transition prediction.'
              : 'Scroll through each project to explore interactive 3D visualizations — from orbital debris capture and morphing airfoils to solar sails hovering above the ecliptic and the boundary layer letting go on a laminar-flow wing.'}
          </p>
        </div>

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
