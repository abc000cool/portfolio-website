import { useCallback, useEffect, useRef, useState } from 'react'
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
/** Tinted per card by --accent, set from the project's own mission patch. */
const actionPrimary = 'project-card__action-primary'
const actionSecondary =
  'border border-white/10 bg-transparent text-slate-300 hover:border-white/25 hover:text-white'

/**
 * Grid reveal stagger, in seconds, with a decaying gap.
 *
 * A flat `i * step` is a metronome: every card lands on the same beat, and the
 * total grows without bound, so the sixth card of a six-card grid arrives long
 * after the reader has started on the first. This spaces the early cards widest
 * and tightens as the grid fills, which reads as one gesture settling rather
 * than six separate entrances, and it approaches SPAN asymptotically - however
 * many cards get added later, the grid is always finished arriving by then.
 *
 *   i:     0      1      2      3      4      5
 *   d:  0.000  0.110  0.179  0.223  0.252  0.269   (span 0.3, falloff 2.2)
 */
const STAGGER_SPAN = 0.3
const STAGGER_FALLOFF = 2.2
const gridStagger = (i: number) => STAGGER_SPAN * (1 - Math.exp(-i / STAGGER_FALLOFF))

/** Peak tilt in degrees at the corners of a card. */
const TILT_DEG = 5
/** Lift, in px, at full hover. */
const TILT_LIFT = -3
/**
 * Approach rate per second for the tilt follow. ~11 settles in about a fifth of
 * a second: quick enough to feel attached to the pointer, slow enough that the
 * card glides rather than snapping to every jitter of the mouse.
 */
const TILT_K = 11
/** Longest frame the follow will integrate. Guards against a lurch after a
 *  background tab, a long paint, or a debugger pause. */
const MAX_DT = 0.05

/**
 * Every card used to be the same indigo. Each project already ships a
 * three-colour mission patch, so the card now takes its accent from that patch:
 * the rail, the spotlight, the patch glow and the hover border all shift per
 * project, which makes the grid read as six distinct missions rather than six
 * instances of one component.
 */
function ProjectCard({
  project,
  index,
}: {
  project: (typeof portfolio.projects)[0]
  index: number
}) {
  const [expanded, setExpanded] = useState(false)
  const reduced = useReducedMotion()
  const accent = project.patchColors[0]
  const specs = project.specs?.slice(0, 3) ?? []

  const cardRef = useRef<HTMLElement>(null)
  /**
   * Tilt state. `t*` is where the pointer says the card should be, `c*` is where
   * the card actually is; the frame loop closes the gap. Held in one ref object
   * so the loop reads and writes plain numbers and allocates nothing per frame.
   */
  const tilt = useRef({ tx: 0, ty: 0, cx: 0, cy: 0, tLift: 0, cLift: 0, raf: 0, last: 0 })

  /**
   * Card geometry, cached for the duration of one hover.
   *
   * The move handler used to call getBoundingClientRect() plus offsetWidth and
   * offsetHeight on every mousemove. Each is a forced layout, and the frame loop
   * is writing a transform to the same element, so every pointer event flushed
   * layout that the previous frame had just invalidated. Measuring once on enter
   * removes the read entirely from the hot path. It is invalidated on scroll,
   * which is the only thing that moves the card while the pointer is inside it.
   */
  const box = useRef({ left: 0, top: 0, w: 0, h: 0, valid: false })

  const readBox = useCallback((card: HTMLElement) => {
    const rect = card.getBoundingClientRect()
    // offsetWidth/Height are the untransformed layout size. The client rect
    // reports the tilted box, and feeding that back in as the divisor would make
    // the tilt target depend on the tilt it just produced.
    box.current = {
      left: rect.left,
      top: rect.top,
      w: card.offsetWidth,
      h: card.offsetHeight,
      valid: true,
    }
  }, [])

  useEffect(() => {
    const invalidate = () => {
      box.current.valid = false
    }
    window.addEventListener('scroll', invalidate, { passive: true })
    window.addEventListener('resize', invalidate)
    return () => {
      window.removeEventListener('scroll', invalidate)
      window.removeEventListener('resize', invalidate)
    }
  }, [])

  /**
   * The tilt used to be written straight to style.transform on every mousemove
   * while a `transform 0.25s ease` transition was live on the card. Every write
   * restarted a quarter-second transition from wherever the previous one had
   * reached, so the card permanently trailed the pointer and only caught up
   * once the mouse stopped - the classic "transition fighting per-event writes"
   * lag. The transform transition is gone from the card entirely now; this loop
   * owns the property and eases toward the pointer itself.
   *
   * The step is frame-rate independent (equal distance covered per unit time at
   * 60Hz and at 144Hz) and dt is clamped, so a stalled tab does not resume with
   * one enormous jump.
   */
  const startLoop = useCallback(() => {
    const s = tilt.current
    // One loop per card. Re-entering while it is already unwinding just retargets.
    if (s.raf) return

    // A function declaration, not a const arrow, so the recursive
    // requestAnimationFrame call below is hoisted rather than a forward
    // reference. One closure per hover, none per frame.
    function frame(now: number) {
      const card = cardRef.current
      if (!card) {
        s.raf = 0
        return
      }

      const dt = Math.min((now - s.last) / 1000, MAX_DT)
      s.last = now
      const k = 1 - Math.exp(-TILT_K * dt)
      s.cx += (s.tx - s.cx) * k
      s.cy += (s.ty - s.cy) * k
      s.cLift += (s.tLift - s.cLift) * k

      const settled =
        Math.abs(s.tx - s.cx) < 0.001 &&
        Math.abs(s.ty - s.cy) < 0.001 &&
        Math.abs(s.tLift - s.cLift) < 0.002

      if (settled && s.tLift === 0) {
        // Home. Clear the inline transform so the card stops owning the
        // property and hand it back to the stylesheet, rather than parking on
        // an identity matrix that keeps it on its own composited layer forever.
        card.style.transform = ''
        s.cx = 0
        s.cy = 0
        s.cLift = 0
        s.raf = 0
        return
      }

      card.style.transform = `perspective(900px) rotateY(${s.cx * TILT_DEG}deg) rotateX(${-s.cy * TILT_DEG}deg) translateY(${s.cLift * TILT_LIFT}px)`
      s.raf = requestAnimationFrame(frame)
    }

    s.last = performance.now()
    s.raf = requestAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const s = tilt.current
    return () => {
      if (s.raf) cancelAnimationFrame(s.raf)
    }
  }, [])

  /**
   * Handles enter as well as move. Without the enter case the spotlight
   * gradient begins its fade-in at its default 50%/50% centre and then jumps to
   * the pointer on the first mousemove - a visible pop on every card entry.
   */
  const handleMove = (e: React.MouseEvent<HTMLElement>) => {
    const card = e.currentTarget
    if (!box.current.valid) readBox(card)
    const b = box.current
    const px = e.clientX - b.left
    const py = e.clientY - b.top
    // The spotlight is glued to the cursor by definition, so it is written raw.
    // Smoothing it would read as the highlight lagging behind the pointer.
    card.style.setProperty('--mx', `${px}px`)
    card.style.setProperty('--my', `${py}px`)

    if (reduced) return
    if (!b.w || !b.h) return
    tilt.current.tx = px / b.w - 0.5
    tilt.current.ty = py / b.h - 0.5
    tilt.current.tLift = 1
    startLoop()
  }

  const handleLeave = () => {
    const s = tilt.current
    s.tx = 0
    s.ty = 0
    s.tLift = 0
    if (reduced) {
      if (cardRef.current) cardRef.current.style.transform = ''
      return
    }
    // Same loop unwinds the tilt, so leaving mid-tilt eases out from wherever
    // the card had got to instead of cutting to a fresh transition.
    startLoop()
  }

  return (
    <article
      ref={cardRef}
      className="project-card glass-card spotlight-card p-6 md:p-7 flex flex-col h-full"
      onMouseEnter={handleMove}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={
        {
          '--accent': accent,
          // Negative delay starts each LED part-way through its cycle, so the
          // grid's status lights are out of phase instead of blinking in unison
          // and none of them pops on at full brightness when the card mounts.
          '--led-delay': `${(-index * 0.63).toFixed(2)}s`,
        } as React.CSSProperties
      }
    >
      {/* Mission rail - the card's only always-on colour cue. */}
      <span className="project-card__rail" aria-hidden="true" />

      <div className="flex items-start gap-4 mb-5">
        <div className="project-card__patch shrink-0">
          <MissionPatch title={project.title} colors={project.patchColors} size={64} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 className="font-display text-lg text-white m-0 leading-snug">
              {project.title}
            </h3>
            {project.status && (
              <span className="project-card__status">
                <span className="project-card__led" aria-hidden="true" />
                {project.status}
              </span>
            )}
          </div>
          {project.category && (
            <p className="project-card__category m-0 mb-1.5">{project.category}</p>
          )}
          <p className="text-sm text-slate-400 m-0 leading-relaxed">{project.description}</p>
        </div>
      </div>

      {/*
       * Spec readout. Opens on hover and on keyboard focus anywhere in the card
       * (:focus-within), so it is not a mouse-only affordance. Height is animated
       * in CSS via grid-template-rows so it costs no JS and no re-render.
       */}
      {specs.length > 0 && (
        <div className="project-card__readout" aria-hidden="true">
          <div className="project-card__readout-inner">
            {specs.map((spec) => (
              <div key={spec.label} className="project-card__spec">
                <span className="project-card__spec-label">{spec.label}</span>
                <span className="project-card__spec-value">{spec.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        {project.tags.map((tag) => (
          <span key={tag} className="tag-badge">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-5 border-t border-white/[0.06]">
        <Link to={`/projects/${project.slug}`} className={`${actionBase} ${actionPrimary}`}>
          View project <span aria-hidden="true" className="cta-arrow">→</span>
        </Link>
        {project.externalUrl && (
          <a
            href={project.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${actionBase} ${actionSecondary}`}
          >
            Live site{' '}
            <span aria-hidden="true" className="cta-arrow cta-arrow--diagonal">
              ↗
            </span>
          </a>
        )}
        {project.githubUrl && (
          <a
            href={project.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${actionBase} ${actionSecondary}`}
          >
            GitHub{' '}
            <span aria-hidden="true" className="cta-arrow cta-arrow--diagonal">
              ↗
            </span>
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
            /* Explicit ease. The default tween curve made the chevron turn at a
               near-constant rate, which reads mechanical next to the panel it
               labels; expo-out lands it with the drawer. */
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
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

      {/*
       * Two beats on the way open - the drawer starts moving, then the text
       * fades up into the space it has already made - and one short beat on the
       * way closed. Height and opacity are given separate transitions instead
       * of one shared duration so the close can be markedly quicker than the
       * open: a drawer you have finished with should get out of the way.
       */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: 'auto',
              opacity: 1,
              transition: {
                height: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
                opacity: { duration: 0.3, delay: 0.07, ease: [0.33, 1, 0.68, 1] },
              },
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: {
                height: { duration: 0.26, ease: [0.33, 1, 0.68, 1] },
                opacity: { duration: 0.14, ease: [0.33, 1, 0.68, 1] },
              },
            }}
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
            transition={{ duration: 0.5, delay: gridStagger(i), ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Offset so this pair's LEDs do not fall into phase with the
                selected grid above them. */}
            <ProjectCard project={project} index={i + selectedProjects.length} />
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
 * this section - the hero CTA, the nav's "All projects", every project-page
 * back link - landed at progress 0, i.e. an empty viewport. The grid below is
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
              transition={{ duration: 0.5, delay: gridStagger(i), ease: [0.22, 1, 0.36, 1] }}
            >
              <ProjectCard project={project} index={i} />
            </motion.div>
          ))}
        </div>
        <OtherProjectsGrid />
      </div>
    </section>
  )
}
