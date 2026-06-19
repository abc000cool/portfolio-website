import { useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
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
import { useMediaQuery } from '../hooks/useMediaQuery'

const selectedProjects = portfolio.projects.filter((p) => p.group !== 'other')
const otherProjects = portfolio.projects.filter((p) => p.group === 'other')

/** Scroll share before any project card appears — title reveals first. */
const INTRO_END = 0.1
const REVEAL_END = 0.92

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

/** Fade in once per card; stays visible after reveal. */
function revealCardOpacity(progress: number, index: number, total: number): number {
  const usable = REVEAL_END - INTRO_END
  const seg = usable / total
  const start = INTRO_END + index * seg
  const fadeInEnd = start + seg * 0.38

  if (progress < start) return 0
  if (progress < fadeInEnd) return smoothstep((progress - start) / (fadeInEnd - start))
  return 1
}

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

function OtherProjectsGrid() {
  if (otherProjects.length === 0) return null

  return (
    <div className="mt-16 pt-12 border-t border-white/[0.06]">
      <h3 className="font-display text-xl md:text-2xl text-white mb-8">Other projects</h3>
      <div className="grid md:grid-cols-2 gap-6">
        {otherProjects.map((project, i) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <ProjectCard project={project} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function PinnedHeading({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0, INTRO_END], [0, 1])
  const y = useTransform(progress, [0, INTRO_END + 0.02], [28, 0])
  const labelOpacity = useTransform(progress, [0, INTRO_END * 0.7], [0, 1])

  return (
    <motion.div style={{ opacity, y }} className="mb-10 md:mb-12">
      <motion.p style={{ opacity: labelOpacity }} className="section-label">
        Work
      </motion.p>
      <div id="projects-heading">
        <h2 className="section-heading">Selected projects</h2>
      </div>
    </motion.div>
  )
}

function PinnedRevealCard({
  index,
  total,
  progress,
  children,
}: {
  index: number
  total: number
  progress: MotionValue<number>
  children: React.ReactNode
}) {
  const opacity = useTransform(progress, (v) => revealCardOpacity(v, index, total))
  const y = useTransform(progress, (v) => {
    const start = INTRO_END + index * ((REVEAL_END - INTRO_END) / total)
    const fadeInEnd = start + ((REVEAL_END - INTRO_END) / total) * 0.38
    if (v < start) return 36
    if (v < fadeInEnd) {
      const t = smoothstep((v - start) / (fadeInEnd - start))
      return 36 * (1 - t)
    }
    return 0
  })

  return (
    <motion.div style={{ opacity, y }}>
      {children}
    </motion.div>
  )
}

export function ProjectsSection() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const reached = useWaypointReached('projects')
  const reduced = useReducedMotion()
  const isNarrow = useMediaQuery('(max-width: 1023px)')

  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ['start start', 'end end'],
  })

  const pinned = !reduced && !isNarrow
  const selectedCount = selectedProjects.length

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
            {selectedProjects.map((project, i) => (
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
          <OtherProjectsGrid />
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
        style={{ height: `${Math.max(260, 140 + selectedCount * 52)}vh` }}
      >
        <div className="sticky top-0 flex min-h-screen flex-col justify-center px-[clamp(1.5rem,5vw,4rem)] py-20">
          <div className="section-inner wide w-full">
            <PinnedHeading progress={scrollYProgress} />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {selectedProjects.map((project, i) => (
                <PinnedRevealCard
                  key={project.id}
                  index={i}
                  total={selectedCount}
                  progress={scrollYProgress}
                >
                  <ProjectCard project={project} />
                </PinnedRevealCard>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="section-inner wide px-[clamp(1.5rem,5vw,4rem)] pb-20">
        <OtherProjectsGrid />
      </div>
    </section>
  )
}
