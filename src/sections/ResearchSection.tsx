import { useEffect, useRef, useState } from 'react'
import { useMotionValueEvent, useScroll, type MotionValue } from 'motion/react'
import { portfolio, type Paper } from '../data/portfolio'
import { useWaypointReached } from '../context/MissionContext'
import { RedactedHeading } from '../components/ui/RedactedHeading'
import { ScanWipe } from '../components/ui/ScanWipe'
import { sectionShellClass } from '../lib/waypointLayout'
import { useReducedMotion } from '../hooks/useReducedMotion'

/** Taller pin = more scroll per page flip. */
const PIN_HEIGHT_VH = 360
/** Fraction of each segment held flat before / after the flip motion. */
const FLIP_HOLD = 0.18

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Maps scroll progress to 0–1 flip amount for a given paper index. */
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

function PaperContent({
  paper,
  variant = 'binder',
}: {
  paper: Paper
  variant?: 'binder' | 'glass'
}) {
  const onCream = variant === 'binder'

  return (
    <>
      <span
        className={`font-mono text-xs ${
          onCream ? 'text-amber-800/90' : 'text-[var(--color-cockpit-amber)]'
        }`}
      >
        {paper.year} — {paper.venue}
      </span>
      <h3
        className={`text-xl md:text-2xl mt-2 mb-4 normal-case tracking-normal leading-snug ${
          onCream ? 'text-stone-900' : 'text-[var(--color-text)]'
        }`}
      >
        {paper.title}
      </h3>
      <p
        className={`text-sm md:text-base leading-relaxed mb-6 ${
          onCream ? 'text-stone-600' : 'text-[var(--color-text-muted)]'
        }`}
      >
        {paper.abstract}
      </p>
      <a
        href={paper.pdfUrl}
        className={`font-mono text-sm uppercase underline underline-offset-4 ${
          onCream
            ? 'text-stone-800 decoration-stone-400 hover:text-stone-950'
            : 'link-underline'
        }`}
      >
        Read Paper →
      </a>
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
      {/* Front */}
      <div
        className="absolute inset-0 rounded-r-lg border border-white/[0.08] bg-[#f4f0e6] text-[#1a1814] p-7 md:p-9 shadow-[-12px_16px_40px_rgba(0,0,0,0.45)]"
        style={{ backfaceVisibility: 'hidden' }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-3 rounded-l-lg"
          style={{
            background: 'linear-gradient(90deg, #c4b89a 0%, #e8e0d0 40%, #f4f0e6 100%)',
          }}
          aria-hidden="true"
        />
        <div className="pl-4 h-full flex flex-col">
          <div className="flex-1">
            <PaperContent paper={paper} />
          </div>
        </div>
        {/* Paper lines */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, #1a1814 0px, #1a1814 1px, transparent 1px, transparent 28px)',
          }}
          aria-hidden="true"
        />
      </div>

      {/* Back */}
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

function StaticResearch({ active }: { active: boolean }) {
  return (
    <section
      id="research"
      data-mission-waypoint
      data-waypoint-side="left"
      className={sectionShellClass('left')}
      aria-labelledby="research-heading"
    >
      <div className="section-inner wide">
        <p className="section-label">Research</p>
        <div id="research-heading" className="mb-12">
          <RedactedHeading active={active}>Research Papers</RedactedHeading>
        </div>
        <ScanWipe active={active}>
          <div className="flex flex-col gap-6 max-w-3xl mx-auto">
            {portfolio.papers.map((paper) => (
              <article
                key={paper.id}
                id={`paper-panel-${paper.id}`}
                className="p-8 md:p-10 glass-card"
                style={{ boxShadow: '-8px 8px 30px rgba(0,0,0,0.5)' }}
              >
                <PaperContent paper={paper} variant="glass" />
              </article>
            ))}
          </div>
        </ScanWipe>
      </div>
    </section>
  )
}

export function ResearchSection() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const reached = useWaypointReached('research')
  const reduced = useReducedMotion()
  const [isNarrow, setIsNarrow] = useState(false)

  const papers = portfolio.papers
  const n = papers.length

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
            <p className="section-label">Research</p>
            <div id="research-heading" className="mb-10 max-w-xl">
              <RedactedHeading active={reached}>Research Papers</RedactedHeading>
            </div>

            <ScanWipe active={reached}>
              <div className="w-full flex justify-end overflow-visible">
                {/* Binder body — shifted right with left clearance for page arc */}
                <div
                  className="relative w-full lg:w-[min(100%,34rem)] xl:w-[min(100%,38rem)] lg:ml-auto lg:mr-[clamp(0rem,4vw,3rem)] min-h-[22rem] md:min-h-[26rem] pl-[clamp(2.5rem,8vw,5.5rem)] overflow-visible"
                  style={{
                    perspective: '1600px',
                    perspectiveOrigin: '18% 50%',
                  }}
                >
                  {/* Binder spine */}
                  <div
                    className="absolute left-[clamp(2.5rem,8vw,5.5rem)] top-2 bottom-2 w-5 rounded-l-md z-[60] pointer-events-none"
                    style={{
                      background:
                        'linear-gradient(90deg, #2a2520 0%, #4a4035 35%, #3d352c 70%, #2a2520 100%)',
                      boxShadow: 'inset -2px 0 6px rgba(0,0,0,0.5)',
                    }}
                    aria-hidden="true"
                  />

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
                        progress={scrollYProgress}
                      />
                    ))}
                  </div>

                  {/* Stack depth shadow under sheets */}
                  <div
                    className="absolute left-[calc(clamp(2.5rem,8vw,5.5rem)+1.5rem)] right-2 -bottom-2 h-4 rounded-full bg-black/40 blur-md pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </ScanWipe>
          </div>
        </div>
      </div>
    </section>
  )
}
