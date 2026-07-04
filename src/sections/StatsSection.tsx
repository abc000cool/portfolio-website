import { useRef } from 'react'
import { motion } from 'motion/react'
import { portfolio } from '../data/portfolio'
import { RedactedHeading } from '../components/ui/RedactedHeading'
import { ScanWipe } from '../components/ui/ScanWipe'
import { useSectionReveal } from '../hooks/useSectionReveal'
import { sectionShellClass } from '../lib/waypointLayout'
import { Odometer } from '../components/ui/Odometer'
import type { Stat } from '../data/portfolio'

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

export function StatsSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const active = useSectionReveal('stats', sectionRef)

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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-16">
          {portfolio.stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10% 0px' }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="glass-card spotlight-card p-6 md:p-8 text-center"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`)
                e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`)
              }}
            >
              <StatValue stat={stat} delay={i * 200} active={active} />
              <p className="text-xs font-medium tracking-wide text-slate-500 mt-3">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <ScanWipe active={active}>
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
