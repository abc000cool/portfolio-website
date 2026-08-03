import { useRef } from 'react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { portfolio } from '../data/portfolio'
import { RedactedHeading } from '../components/ui/RedactedHeading'
import { ScanWipe } from '../components/ui/ScanWipe'
import { useSectionReveal } from '../hooks/useSectionReveal'
import { sectionShellClass } from '../lib/waypointLayout'

/**
 * Two-beat sequence for the columns inside the block reveal.
 *
 * The copy and the photograph used to arrive as a single slab. These add a
 * small extra lift on top of the ScanWipe, offset so the text leads and the
 * image follows a beat later - you read left, then look right. Only `y` is
 * animated here: the parent already owns the fade, and nesting a second
 * opacity ramp inside it would make both columns fade twice.
 */
const columnLift = { y: 12 }
const COLUMN_SETTLED = { y: 0 }
const columnBeat = (delay: number) =>
  ({ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }) as const

export function IsmSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const active = useSectionReveal('ism', sectionRef)
  const { ism } = portfolio

  return (
    <section
      ref={sectionRef}
      id="ism"
      data-mission-waypoint
      data-waypoint-side="center"
      className={`${sectionShellClass('center')} relative overflow-hidden`}
      aria-labelledby="ism-heading"
    >
      <div className="section-inner wide">
        <p className="section-label">{ism.district} Program</p>
        <div id="ism-heading" className="mb-6">
          <RedactedHeading active={active}>{ism.programName}</RedactedHeading>
        </div>

        <ScanWipe active={active}>
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <motion.div
              initial={columnLift}
              animate={active ? COLUMN_SETTLED : columnLift}
              transition={columnBeat(0.06)}
            >
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-indigo-300/90 mb-3">
                {ism.tagline}
              </p>
              <p className="text-[var(--color-text-muted)] text-lg leading-relaxed mb-6">
                {ism.description}
              </p>
              <p className="text-sm text-slate-400 mb-8">
                <span className="text-[var(--color-cockpit-amber)] font-mono text-xs uppercase tracking-wider mr-2">
                  Focus
                </span>
                {ism.focus}
              </p>
              <Link
                to="/ism"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-mono text-xs uppercase tracking-widest text-white bg-indigo-500/20 border border-indigo-400/40 hover:bg-indigo-500/30 transition-colors no-underline"
              >
                Explore ISM journey →
              </Link>
            </motion.div>

            <motion.div
              className="glass-card overflow-hidden"
              initial={columnLift}
              animate={active ? COLUMN_SETTLED : columnLift}
              transition={columnBeat(0.2)}
            >
              <img
                src={ism.image}
                alt="Independent Study and Mentorship program"
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </motion.div>
          </div>
        </ScanWipe>
      </div>
    </section>
  )
}
