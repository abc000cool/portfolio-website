import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMotionValueEvent, useScroll, type MotionValue } from 'motion/react'
import {
  getBinderPapers,
  getFeaturedResearchPaper,
  type Paper,
} from '../data/portfolio'
import { useWaypointReached } from '../context/MissionContext'
import { RedactedHeading } from '../components/ui/RedactedHeading'
import { ScanWipe } from '../components/ui/ScanWipe'
import { sectionShellClass } from '../lib/waypointLayout'
import { useReducedMotion } from '../hooks/useReducedMotion'

const MorphingAirfoil = lazy(() =>
  import('../components/three/MorphingAirfoil').then((m) => ({ default: m.MorphingAirfoil })),
)

/** Taller pin = more scroll per page flip (2 binder papers). */
const PIN_HEIGHT_VH = 280
/** Fraction of each segment held flat before / after the flip motion. */
const FLIP_HOLD = 0.18

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

function paperFlipT(scrollProgress: number, index: number, total: number): number {
  const segment = 1 / total
  const segStart = index * segment
  const flipStart = segStart + segment * FLIP_HOLD
  const flipEnd = segStart + segment * (1 - FLIP_HOLD)
  if (scrollProgress <= flipStart) return 0
  if (scrollProgress >= flipEnd) return 1
  return smoothstep((scrollProgress - flipStart) / (flipEnd - flipStart))
}

function activePaperIndex(scrollProgress: number, total: number): number {
  return Math.min(total - 1, Math.max(0, Math.floor(scrollProgress * total)))
}

const binderFaceClass =
  'rounded-r-lg border border-white/[0.08] bg-[#f4f0e6] text-[#1a1814] p-6 md:p-8 shadow-[-12px_16px_40px_rgba(0,0,0,0.45)]'

function BinderPaperFace({ paper }: { paper: Paper }) {
  return (
    <>
      <div
        className="absolute left-0 top-0 bottom-0 w-3 rounded-l-lg"
        style={{
          background: 'linear-gradient(90deg, #c4b89a 0%, #e8e0d0 40%, #f4f0e6 100%)',
        }}
        aria-hidden="true"
      />
      <div className="pl-4">
        <span className="font-mono text-xs text-amber-800/90">
          {paper.year} — {paper.venue}
        </span>
        <h3 className="text-lg md:text-xl lg:text-[1.35rem] mt-2 mb-5 normal-case tracking-normal leading-snug text-stone-900">
          {paper.title}
        </h3>
        <Link
          to={`/research/${paper.slug}`}
          className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-amber-900/80 hover:text-amber-950 no-underline transition-colors"
        >
          Read abstract →
        </Link>
      </div>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, #1a1814 0px, #1a1814 1px, transparent 1px, transparent 28px)',
        }}
        aria-hidden="true"
      />
    </>
  )
}

function PaperSummary({ paper }: { paper: Paper }) {
  return (
    <>
      <span className="font-mono text-xs text-[var(--color-cockpit-amber)]">
        {paper.year} — {paper.venue}
      </span>
      <h3 className="text-xl md:text-2xl mt-2 mb-4 normal-case tracking-normal leading-snug text-[var(--color-text)]">
        {paper.title}
      </h3>
      <Link
        to={`/research/${paper.slug}`}
        className="link-underline text-sm font-medium text-indigo-300 no-underline"
      >
        Read abstract →
      </Link>
    </>
  )
}

function BinderPaper({
  paper,
  index,
  total,
  progress,
}: {
  paper: Paper
  index: number
  total: number
  progress: MotionValue<number>
}) {
  const sheetRef = useRef<HTMLDivElement>(null)

  const applyTransform = (v: number) => {
    const el = sheetRef.current
    if (!el) return

    const t = paperFlipT(v, index, total)
    const rotateY = -168 * t
    const active = activePaperIndex(v, total)

    el.style.transform = `rotateY(${rotateY}deg)`
    el.style.zIndex = String(
      index === active ? 50 : t >= 1 ? index : total - index + 5,
    )
  }

  useMotionValueEvent(progress, 'change', applyTransform)

  useEffect(() => {
    applyTransform(progress.get())
  }, [progress, index, total])

  return (
    <div
      ref={sheetRef}
      className="absolute inset-0"
      style={{
        transformStyle: 'preserve-3d',
        transformOrigin: 'left center',
      }}
    >
      <div
        className={`absolute inset-0 ${binderFaceClass}`}
        style={{ backfaceVisibility: 'hidden' }}
      >
        <BinderPaperFace paper={paper} />
      </div>
      <div
        className="absolute inset-0 rounded-r-lg bg-[#e0d8c8] border border-[#c4b89a]/40"
        style={{
          backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
        }}
        aria-hidden="true"
      />
    </div>
  )
}

function ResearchBinder({
  papers,
  progress,
  align = 'right',
}: {
  papers: Paper[]
  progress?: MotionValue<number>
  align?: 'right' | 'center'
}) {
  const n = papers.length
  if (n === 0) return null

  const justify = align === 'center' ? 'justify-center' : 'justify-end'
  const margin = align === 'center' ? 'mx-auto' : 'lg:ml-auto lg:mr-[clamp(0rem,2vw,1.5rem)]'

  return (
    <div className={`w-full flex ${justify} overflow-visible`}>
      <div
        className={`relative w-full lg:w-[min(100%,36rem)] xl:w-[min(100%,40rem)] ${margin} pl-[clamp(2.5rem,8vw,5.5rem)] overflow-visible`}
        style={{
          perspective: '1600px',
          perspectiveOrigin: align === 'center' ? '50% 50%' : '18% 50%',
        }}
      >
        <div
          className="absolute left-[clamp(2.5rem,8vw,5.5rem)] top-2 bottom-2 w-5 rounded-l-md z-[60] pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, #2a2520 0%, #4a4035 35%, #3d352c 70%, #2a2520 100%)',
            boxShadow: 'inset -2px 0 6px rgba(0,0,0,0.5)',
          }}
          aria-hidden="true"
        />

        <div className="grid" aria-hidden="true">
          {papers.map((paper) => (
            <div
              key={`sizer-${paper.id}`}
              className="col-start-1 row-start-1 invisible pointer-events-none select-none"
            >
              <div className={`relative ${binderFaceClass}`}>
                <BinderPaperFace paper={paper} />
              </div>
            </div>
          ))}
        </div>

        {progress ? (
          <div
            className="absolute left-[calc(clamp(2.5rem,8vw,5.5rem)+1rem)] right-0 top-0 bottom-0 overflow-visible"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {papers.map((paper, i) => (
              <BinderPaper
                key={paper.id}
                paper={paper}
                index={i}
                total={n}
                progress={progress}
              />
            ))}
          </div>
        ) : (
          <div
            className="absolute left-[calc(clamp(2.5rem,8vw,5.5rem)+1rem)] right-0 top-0 bottom-0"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <div className={`absolute inset-0 ${binderFaceClass}`}>
              <BinderPaperFace paper={papers[0]} />
            </div>
          </div>
        )}

        <div
          className="absolute left-[calc(clamp(2.5rem,8vw,5.5rem)+1.5rem)] right-2 -bottom-2 h-4 rounded-full bg-black/40 blur-md pointer-events-none"
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

function FeaturedResearch({ paper, active }: { paper: Paper; active: boolean }) {
  const scrollZoneRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: scrollZoneRef,
    offset: ['start start', 'end end'],
  })

  const viewer = (
    <Suspense fallback={<div className="airfoil-viewer h-[300px] md:h-[380px] lg:h-[420px]" />}>
      <MorphingAirfoil
        variant="featured"
        progress={reduced ? undefined : scrollYProgress}
        scrollProgress={reduced ? 1 : 0}
        active={active}
        className="h-[300px] md:h-[380px] lg:h-[420px]"
      />
    </Suspense>
  )

  return (
    <div
      id="featured-research"
      className="featured-research"
      aria-labelledby="featured-research-heading"
    >
      <div className="section-inner wide">
        <div className="featured-research__header">
          <p className="section-label">Featured Research</p>
          <h3 id="featured-research-heading" className="featured-research__heading">
            Morphing airfoil optimization
          </h3>
          <p className="featured-research__lede">
            Interactive cross-section morphing from NACA 2412 baseline to QAOA-optimized geometry —
            scroll to explore the shape transition.
          </p>
        </div>

        {reduced ? (
          <div className="featured-research__body">
            <ScanWipe active={active}>
              <div className="featured-research__grid">
                <FeaturedResearchCard paper={paper} />
                <div className="featured-research__viewer">
                  {viewer}
                  <p className="featured-research__viewer-hint font-mono text-[10px] uppercase tracking-widest text-slate-500 text-center mt-3">
                    Optimized morph profile
                  </p>
                </div>
              </div>
            </ScanWipe>
          </div>
        ) : (
          <div ref={scrollZoneRef} className="featured-research__scroll-zone">
            <div className="featured-research__sticky">
              <ScanWipe active={active}>
                <div className="featured-research__grid w-full">
                  <FeaturedResearchCard paper={paper} />
                  <div className="featured-research__viewer">
                    {viewer}
                    <p className="featured-research__viewer-hint font-mono text-[10px] uppercase tracking-widest text-slate-500 text-center mt-3">
                      Scroll to morph baseline → optimized
                    </p>
                  </div>
                </div>
              </ScanWipe>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FeaturedResearchCard({ paper }: { paper: Paper }) {
  return (
    <article className="featured-research__card glass-card p-6 md:p-8 lg:p-10">
      <span className="font-mono text-xs text-[var(--color-cockpit-amber)]">
        {paper.year} — {paper.venue}
      </span>
      <h4 className="font-display text-xl md:text-2xl text-white mt-3 mb-4 leading-snug tracking-tight">
        {paper.title}
      </h4>
      <p className="text-sm text-slate-400 leading-relaxed mb-6">{paper.abstract}</p>

      <div className="featured-research__metrics">
        <div className="featured-research__metric">
          <span className="featured-research__metric-value">9.3%</span>
          <span className="featured-research__metric-label">Drag reduction vs NACA 2412</span>
        </div>
        <div className="featured-research__metric">
          <span className="featured-research__metric-value">37%</span>
          <span className="featured-research__metric-label">Lift improvement</span>
        </div>
        <div className="featured-research__metric">
          <span className="featured-research__metric-value">QAOA</span>
          <span className="featured-research__metric-label">Discrete sampling at p=2</span>
        </div>
      </div>

      <Link
        to={`/research/${paper.slug}`}
        className="inline-flex items-center gap-2 mt-8 px-5 py-2.5 rounded-full font-mono text-xs uppercase tracking-widest text-white bg-indigo-500/20 border border-indigo-400/40 hover:bg-indigo-500/30 transition-colors no-underline"
      >
        Read full abstract →
      </Link>
    </article>
  )
}

function StaticResearch({ active }: { active: boolean }) {
  const binderPapers = getBinderPapers()
  const featuredPaper = getFeaturedResearchPaper()

  return (
    <section
      id="research"
      data-mission-waypoint
      data-waypoint-side="left"
      className={sectionShellClass('left')}
      aria-labelledby="research-heading"
    >
      <div className="section-inner wide">
        <p className="section-label">Pending Research</p>
        <div id="research-heading" className="mb-12">
          <RedactedHeading active={active}>Pending Research</RedactedHeading>
        </div>
        <ScanWipe active={active}>
          <div className="flex flex-col gap-6 max-w-3xl mx-auto mb-16">
            {binderPapers.map((paper) => (
              <article
                key={paper.id}
                id={`paper-panel-${paper.id}`}
                className="p-8 md:p-10 glass-card"
                style={{ boxShadow: '-8px 8px 30px rgba(0,0,0,0.5)' }}
              >
                <PaperSummary paper={paper} />
              </article>
            ))}
          </div>
        </ScanWipe>
      </div>

      {featuredPaper && <FeaturedResearch paper={featuredPaper} active={active} />}
    </section>
  )
}

export function ResearchSection() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const reached = useWaypointReached('research')
  const reduced = useReducedMotion()
  const [isNarrow, setIsNarrow] = useState(false)

  const binderPapers = getBinderPapers()
  const featuredPaper = getFeaturedResearchPaper()
  const n = binderPapers.length

  useEffect(() => {
    setIsNarrow(window.innerWidth < 1024)
  }, [])

  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ['start start', 'end end'],
  })

  const pinned = !reduced && !isNarrow && n >= 2

  if (!pinned) {
    return <StaticResearch active={reached} />
  }

  return (
    <section
      id="research"
      data-mission-waypoint
      data-waypoint-side="left"
      className="relative shell-right overflow-visible"
      aria-labelledby="research-heading"
    >
      <div
        ref={wrapRef}
        className="relative"
        style={{ height: `${PIN_HEIGHT_VH}vh` }}
      >
        <div className="sticky top-0 flex min-h-screen flex-col justify-center px-[clamp(1.5rem,5vw,4rem)] py-20 overflow-visible">
          <div className="section-inner wide w-full overflow-visible">
            <p className="section-label">Pending Research</p>
            <div id="research-heading" className="mb-10 max-w-xl">
              <RedactedHeading active={reached}>Pending Research</RedactedHeading>
            </div>

            <ScanWipe active={reached}>
              <ResearchBinder papers={binderPapers} progress={scrollYProgress} align="right" />
            </ScanWipe>
          </div>
        </div>
      </div>

      {featuredPaper && <FeaturedResearch paper={featuredPaper} active={reached} />}
    </section>
  )
}
