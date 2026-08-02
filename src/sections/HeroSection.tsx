import { useRef } from 'react'
import { motion } from 'motion/react'
import { MagneticButton } from '../components/ui/MagneticButton'
import { scrollToSection } from '../lib/lenis'
import { sectionShellClass } from '../lib/waypointLayout'
import { useSectionReveal } from '../hooks/useSectionReveal'
import { useIsPhoneLayout, useLightExperience } from '../hooks/useTouchDevice'
import { revealHidden, revealVisible } from '../lib/revealMotion'

/**
 * The intro screen directly above already carries the name, the headline and
 * the tagline. This section deliberately does not repeat any of them — it
 * opens on the work itself and the three hardest pieces of evidence for it.
 * Every string below is drawn from portfolio.about / portfolio.stats.
 */
const PROOF = [
  {
    value: 'US patent',
    label: 'SWEEP — a spacecraft design that clears orbital debris, presented at AAS 248.',
  },
  {
    value: '1.5%',
    label: 'STRATOS, my flight-performance simulator, predicts Boeing 737-800 stall speed to within this.',
  },
  {
    value: 'NASA Goddard',
    label:
      'Mentored by Dr. Giuseppe Cataldo, Assistant Chief for Technology at NASA Goddard Space Flight Center.',
  },
] as const

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const active = useSectionReveal('hero', sectionRef)
  const light = useLightExperience()
  const phone = useIsPhoneLayout()
  const hidden = revealHidden(light)
  const visible = revealVisible(light)

  const fade = (delay: number) => ({
    initial: hidden,
    animate: active ? visible : hidden,
    transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
  })

  return (
    <section
      ref={sectionRef}
      id="hero"
      data-mission-waypoint
      data-waypoint-side="right"
      className={`${sectionShellClass('right')} relative !pt-28 md:!pt-36 ${phone ? '-mt-[10vh]' : ''}`}
      aria-labelledby="hero-heading"
    >
      <div className="section-inner wide max-w-3xl">
        <motion.p {...fade(0)} className="section-label">
          What I work on
        </motion.p>

        <motion.h2
          {...fade(0.06)}
          id="hero-heading"
          className="font-display text-4xl md:text-5xl lg:text-6xl leading-[1.06] mb-6 tracking-tight bg-gradient-to-br from-white via-white to-indigo-200 bg-clip-text text-transparent"
        >
          I design and simulate aerospace systems.
        </motion.h2>

        <motion.p
          {...fade(0.12)}
          className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl leading-relaxed"
        >
          Six papers and preprints, one thread: quantum and classical optimization for aircraft
          and spacecraft.
        </motion.p>

        <motion.dl
          {...fade(0.18)}
          className="grid gap-5 sm:grid-cols-3 mb-10 pt-8 border-t border-white/[0.08]"
        >
          {PROOF.map((item) => (
            <div key={item.value}>
              <dt className="font-display text-2xl md:text-[1.75rem] leading-tight tracking-tight text-white">
                {item.value}
              </dt>
              <dd className="mt-2 m-0 text-sm text-slate-400 leading-relaxed">{item.label}</dd>
            </div>
          ))}
        </motion.dl>

        <motion.div {...fade(0.24)} className="flex flex-wrap gap-3">
          <MagneticButton onClick={() => scrollToSection('projects')}>
            View my work
          </MagneticButton>
          <MagneticButton variant="ghost" onClick={() => scrollToSection('contact')}>
            Get in touch
          </MagneticButton>
        </motion.div>
      </div>
    </section>
  )
}
