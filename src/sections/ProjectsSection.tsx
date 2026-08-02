import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { portfolio } from '../data/portfolio'
import { useSectionReveal } from '../hooks/useSectionReveal'
import { useLightExperience } from '../hooks/useTouchDevice'
import { revealHidden, revealVisible } from '../lib/revealMotion'
import { RedactedHeading } from '../components/ui/RedactedHeading'
import { MissionPatch } from '../components/ui/MissionPatch'
import { sectionShellClass } from '../lib/waypointLayout'
import { useReducedMotion } from '../hooks/useReducedMotion'

const selectedProjects = portfolio.projects.filter((p) => p.group !== 'other')
const otherProjects = portfolio.projects.filter((p) => p.group === 'other')

/**
 * Card footer controls. Pill sizing keeps every control at a ~40px tap target
 * (WCAG 2.2 target size) instead of the 16px text links this replaced.
 */
const actionBase =
  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-[0.8125rem] leading-5 font-medium no-underline transition-colors'
const actionPrimary =
  'border border-indigo-400/30 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20 hover:text-white'
const actionSecondary =
  'border border-white/10 bg-transparent text-slate-300 hover:border-white/25 hover:text-white'

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

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-5 border-t border-white/[0.06]">
        <Link to={`/projects/${project.slug}`} className={`${actionBase} ${actionPrimary}`}>
          View project <span aria-hidden="true">→</span>
        </Link>
        {project.externalUrl && (
          <a
            href={project.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${actionBase} ${actionSecondary}`}
          >
            Live site <span aria-hidden="true">↗</span>
          </a>
        )}
        {project.githubUrl && (
          <a
            href={project.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${actionBase} ${actionSecondary}`}
          >
            GitHub <span aria-hidden="true">↗</span>
          </a>
        )}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className={`${actionBase} ${actionSecondary} cursor-pointer`}
        >
          Details
          <motion.svg
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
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
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
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
            transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
          >
            <ProjectCard project={project} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/**
 * Projects renders as a plain responsive grid.
 *
 * It used to run a scroll-scrubbed pinned mode across a ~400vh container, where
 * card opacity was a function of scroll progress. Every deliberate jump into
 * this section — the hero CTA, the nav's "All projects", every project-page
 * back link — landed at progress 0, i.e. an empty viewport. The grid below is
 * the same content, visible the instant you arrive.
 */
export function ProjectsSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const reached = useSectionReveal('projects', sectionRef)
  const light = useLightExperience()
  const cardHidden = revealHidden(light)
  const cardVisible = revealVisible(light)

  return (
    <section
      ref={sectionRef}
      id="projects"
      data-mission-waypoint
      data-waypoint-side="right"
      className={sectionShellClass('right')}
      aria-labelledby="projects-heading"
    >
      <div className="section-inner wide">
        <p className="section-label">Work</p>
        <div id="projects-heading" className="mb-12">
          <RedactedHeading active={reached}>Selected projects</RedactedHeading>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {selectedProjects.map((project, i) => (
            <motion.div
              key={project.id}
              initial={cardHidden}
              animate={reached ? cardVisible : cardHidden}
              transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
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
