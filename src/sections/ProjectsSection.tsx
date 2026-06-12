import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { Link } from 'react-router-dom'
import { portfolio } from '../data/portfolio'
import { useWaypointReached } from '../context/MissionContext'
import { RedactedHeading } from '../components/ui/RedactedHeading'
import { MissionPatch } from '../components/ui/MissionPatch'
import { sectionShellClass } from '../lib/waypointLayout'
import { useReducedMotion } from '../hooks/useReducedMotion'

function ProjectCard({
  project,
}: {
  project: (typeof portfolio.projects)[0]
}) {
  const [expanded, setExpanded] = useState(false)
  const reduced = useReducedMotion()

  const handleMove = (e: React.MouseEvent<HTMLElement>) => {
    const card = e.currentTarget
    const rect = card.getBoundingClientRect()
    card.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    card.style.setProperty('--my', `${e.clientY - rect.top}px`)

    if (reduced) return
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    card.style.transform = `perspective(900px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) translateY(-3px)`
  }

  const handleLeave = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.transform = ''
  }

  return (
    <article
      className="glass-card spotlight-card p-6 md:p-7 flex flex-col h-full"
      data-cursor="target"
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ transition: 'transform 0.25s ease, border-color 0.3s ease, background 0.3s ease' }}
    >
      <div className="flex items-start gap-4 mb-5">
        <div className="shrink-0 drop-shadow-[0_4px_16px_rgba(99,102,241,0.25)]">
          <MissionPatch title={project.title} colors={project.patchColors} size={64} />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 className="font-display text-lg text-white m-0 leading-snug">
              {project.title}
            </h3>
            {project.status && (
              <span className="tag-badge text-[10px] py-0.5">{project.status}</span>
            )}
          </div>
          <p className="text-sm text-slate-400 m-0 leading-relaxed">{project.description}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {project.tags.map((tag) => (
          <span key={tag} className="tag-badge">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-4 border-t border-white/[0.06]">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={`/projects/${project.slug}`}
            className="link-underline text-xs font-medium text-indigo-300 no-underline"
          >
            View project →
          </Link>
          {project.externalUrl && (
            <a
              href={project.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline text-xs font-medium text-slate-400 hover:text-white no-underline"
            >
              Live site →
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white bg-transparent border-none cursor-pointer transition-colors"
        >
          Details
          <motion.svg
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
          >
            <path d="M1 3 L5 7 L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </motion.svg>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="mt-4 text-sm text-slate-400 leading-relaxed">{project.details}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  )
}

/** Per-card scrub window — tuned so the first card appears early in the pin. */
function cardWindow(index: number, total: number) {
  const segment = 0.92 / Math.max(total, 1)
  const start = Math.max(0, index * segment * 0.72)
  return { start, end: start + segment * 0.42 }
}

function PinnedCard({
  index,
  total,
  progress,
  children,
}: {
  index: number
  total: number
  progress: MotionValue<number>
  children: ReactNode
}) {
  const { start, end } = cardWindow(index, total)
  const fromX = index % 2 === 0 ? -90 : 90

  const x = useTransform(progress, [start, end], [fromX, 0], { clamp: true })
  const y = useTransform(progress, [start, end], [48, 0], { clamp: true })
  const opacity = useTransform(
    progress,
    [start, end],
    [index === 0 ? 0.88 : 0, 1],
    { clamp: true },
  )

  // Newly arrived card scales up briefly, recedes when the next one arrives,
  // then everything settles to 1 once the scene completes.
  const isLast = index === total - 1
  const nextStart = cardWindow(index + 1, total).start
  const scale = useTransform(
    progress,
    isLast ? [end, 0.88] : [end, nextStart + 0.06, 0.88],
    isLast ? [1.04, 1] : [1.04, 0.97, 1],
    { clamp: true },
  )

  // Apply opacity manually: Motion's WAAPI scroll-timeline fast path miscomputes
  // progress inside this sticky/pinned container, so opt out of the style binding.
  const fadeRef = useRef<HTMLDivElement>(null)
  useMotionValueEvent(opacity, 'change', (v) => {
    if (fadeRef.current) fadeRef.current.style.opacity = v.toFixed(3)
  })
  useEffect(() => {
    if (fadeRef.current) fadeRef.current.style.opacity = opacity.get().toFixed(3)
  }, [opacity])

  return (
    <div ref={fadeRef} style={{ opacity: 0 }}>
      <motion.div style={{ x, y, scale }} className="h-full">
        {children}
      </motion.div>
    </div>
  )
}

export function ProjectsSection() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const reached = useWaypointReached('projects')
  const reduced = useReducedMotion()
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    setIsNarrow(window.innerWidth < 1024)
  }, [])

  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ['start start', 'end end'],
  })

  const pinned = !reduced && !isNarrow

  const heading = (
    <>
      <p className="section-label">Work</p>
      <div id="projects-heading" className="mb-12">
        <RedactedHeading active={reached}>Selected projects</RedactedHeading>
      </div>
    </>
  )

  if (!pinned) {
    return (
      <section
        id="projects"
        data-mission-waypoint
        data-waypoint-side="right"
        className={sectionShellClass('right')}
        aria-labelledby="projects-heading"
      >
        <div className="section-inner wide">
          {heading}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {portfolio.projects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 36 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10% 0px' }}
                transition={{ duration: 0.7, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <ProjectCard project={project} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      id="projects"
      data-mission-waypoint
      data-waypoint-side="right"
      className="relative shell-right"
      aria-labelledby="projects-heading"
    >
      <div
        ref={wrapRef}
        className="relative"
        style={{ height: `${Math.max(240, portfolio.projects.length * 72)}vh` }}
      >
        <div className="sticky top-0 flex min-h-screen flex-col justify-center px-[clamp(1.5rem,5vw,4rem)] py-20">
          <div className="section-inner wide w-full">
            {heading}
            <div className="grid lg:grid-cols-3 gap-6 items-stretch">
              {portfolio.projects.map((project, i) => (
                <PinnedCard
                  key={project.id}
                  index={i}
                  total={portfolio.projects.length}
                  progress={scrollYProgress}
                >
                  <ProjectCard project={project} />
                </PinnedCard>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
