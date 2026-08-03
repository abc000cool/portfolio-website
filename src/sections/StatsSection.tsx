import { useRef } from 'react'
import { motion } from 'motion/react'
import { portfolio } from '../data/portfolio'
import { RedactedHeading } from '../components/ui/RedactedHeading'
import { ScanWipe } from '../components/ui/ScanWipe'
import { useSectionReveal } from '../hooks/useSectionReveal'
import { sectionShellClass } from '../lib/waypointLayout'
import { Odometer } from '../components/ui/Odometer'
import type { Stat } from '../data/portfolio'
import { useLightExperience } from '../hooks/useTouchDevice'
import { revealHidden, revealVisible } from '../lib/revealMotion'

/**
 * Decaying grid stagger, in seconds. A flat `i * step` gives every tile the
 * same beat and lets the total run away with the tile count - at the old 0.08
 * the sixth tile started 0.4s after the first and finished 1.1s in, by which
 * point the reader is already past it. This spaces the first tiles widest and
 * closes up as the row fills, and the total is asymptotically capped at SPAN
 * however many stats get added later.
 *
 *   i:     0      1      2      3      4      5
 *   d:  0.000  0.110  0.179  0.223  0.252  0.269
 */
const STAGGER_SPAN = 0.3
const STAGGER_FALLOFF = 2.2
const gridStagger = (i: number) => STAGGER_SPAN * (1 - Math.exp(-i / STAGGER_FALLOFF))

function StatValue({
  stat,
  active,
  delay,
}: {
  stat: Stat
  active: boolean
  delay: number
}) {
  if (stat.display) {
    return (
      <div className="flex justify-center items-baseline gap-1">
        <span className="font-display text-3xl md:text-4xl font-semibold text-white tracking-tight">
          {stat.display}
        </span>
        {stat.suffix && <span className="font-body text-sm text-slate-500">{stat.suffix}</span>}
      </div>
    )
  }

  return (
    <div className="flex justify-center">
      <Odometer
        value={stat.value ?? 0}
        suffix={stat.suffix}
        delay={delay}
        active={active}
        static={stat.static}
      />
    </div>
  )
}

/** Writes the spotlight centre for a tile. Shared by enter and move. */
const setSpotlight = (e: React.MouseEvent<HTMLElement>) => {
  const rect = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`)
}

export function StatsSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const active = useSectionReveal('stats', sectionRef)
  const light = useLightExperience()
  const hidden = revealHidden(light)
  const visible = revealVisible(light)

  return (
    <section
      ref={sectionRef}
      id="stats"
      data-mission-waypoint
      data-waypoint-side="right"
      className={sectionShellClass('right')}
      aria-labelledby="stats-heading"
    >
      <div className="section-inner wide">
        <p className="section-label">Recognition</p>
        <div id="stats-heading" className="mb-12">
          <RedactedHeading active={active} as="h2">
            Awards &amp; experiences
          </RedactedHeading>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mb-16">
          {portfolio.stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={hidden}
              animate={active ? visible : hidden}
              transition={{
                duration: light ? 0.45 : 0.6,
                delay: gridStagger(i),
                ease: [0.22, 1, 0.36, 1],
              }}
              className="glass-card spotlight-card p-6 md:p-8 text-center"
              /*
               * Enter is handled as well as move so the spotlight gradient does
               * not start its fade-in centred at the tile's default 50%/50% and
               * then jump to the pointer on the first mousemove.
               */
              onMouseEnter={setSpotlight}
              onMouseMove={setSpotlight}
            >
              {/* Count-up starts just after its own tile has finished lifting,
                  so the number is not already running while the card moves. */}
              <StatValue stat={stat} delay={Math.round(gridStagger(i) * 1000) + 140} active={active} />
              <p className="text-xs font-medium tracking-wide text-slate-500 mt-3">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/*
         * Held until the tile grid has committed. The two lower columns are a
         * second beat of the section, not part of the same block, and at the
         * default 0.1 they used to start lifting while the tiles above them
         * were still arriving.
         */}
        <ScanWipe active={active} delay={0.3}>
          <div className="grid lg:grid-cols-2 gap-10">
            <div>
              <h3 className="font-display text-xl text-white mb-6">Professional experiences</h3>
              <div className="space-y-4">
                {portfolio.experiences.map((exp) => (
                  <article key={exp.id} className="glass-card p-5 md:p-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                      <h4 className="font-display text-base text-white m-0">{exp.role}</h4>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-indigo-300/80">
                        {exp.type}
                      </span>
                    </div>
                    <p className="text-sm text-indigo-200/90 m-0 mb-1">
                      {exp.organization} · {exp.period}
                    </p>
                    <p className="text-sm text-slate-400 leading-relaxed m-0">{exp.description}</p>
                  </article>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-display text-xl text-white mb-6">Awards &amp; achievements</h3>
              <div className="space-y-4">
                {portfolio.awards.map((award) => (
                  <article key={award.id} className="glass-card p-5 md:p-6">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-cockpit-amber)] mb-2">
                      {award.category}
                    </p>
                    <h4 className="font-display text-base text-white m-0 mb-2">{award.title}</h4>
                    <p className="text-sm text-slate-400 leading-relaxed m-0">{award.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </ScanWipe>
      </div>
    </section>
  )
}
