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
  const fallback =
    staticProgress ?? (config.viewer === 'airfoil' ? 1 : 0.4)

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
        }
      })()}
      <p className="research-showcase__viewer-hint font-mono text-[10px] uppercase tracking-widest text-slate-500 text-center mt-3">
        {config.viewerHint}
      </p>
    </Suspense>
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
      <div className="flex flex-wrap gap-3 mb-5">
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
    ? Math.round(config.scrollHeightVh * MOBILE_SCROLL_SCALE)
    : config.scrollHeightVh

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

      <div className="research-showcase__metrics">
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
    </article>
  )

  const viewer = (
    <div className="research-showcase__viewer">
      <ResearchViewer
        config={config}
        active={viewerActive}
        scrollProgress={reduced ? undefined : scrollYProgress}
        staticProgress={reduced ? (config.viewer === 'airfoil' ? 1 : 0.45) : 0}
      />
    </div>
  )

  const content = (
    <div className={gridClass}>
      {card}
      {viewer}
    </div>
  )

  return (
    <div
      id={config.id}
      className="research-showcase-block"
      aria-labelledby={`${config.id}-title`}
    >
      {reduced ? (
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
              ? 'Pending research across orbital debris mitigation, morphing airfoil optimization, and fluid-dynamics traffic modeling.'
              : 'Scroll through each project to explore interactive 3D visualizations — from orbital debris capture to morphing airfoil optimization and fluid-dynamics traffic flow.'}
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
