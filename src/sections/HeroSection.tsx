import { useRef } from 'react'
import { motion } from 'motion/react'
import { portfolio } from '../data/portfolio'
import { ScrambleText } from '../components/ui/ScrambleText'
import { MagneticButton } from '../components/ui/MagneticButton'
import { scrollToSection } from '../lib/lenis'
import { sectionShellClass } from '../lib/waypointLayout'
import { useSectionReveal } from '../hooks/useSectionReveal'
import { useLightExperience } from '../hooks/useTouchDevice'
import { revealHidden, revealVisible } from '../lib/revealMotion'

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const active = useSectionReveal('hero', sectionRef)
  const light = useLightExperience()
  const hidden = revealHidden(light)
  const visible = revealVisible(light)

  const fade = (delay: number) => ({
    initial: hidden,
    animate: active ? visible : hidden,
    transition: { duration: light ? 0.55 : 0.75, delay, ease: [0.22, 1, 0.36, 1] as const },
  })

  return (
    <section
      ref={sectionRef}
      id="hero"
      data-mission-waypoint
      data-waypoint-side="right"
      className={`${sectionShellClass('right')} relative !pt-28 md:!pt-36`}
      aria-labelledby="hero-heading"
    >
      <div className="section-inner wide max-w-3xl">
        <motion.p {...fade(0)} className="section-label">
          The engineer behind the missions
        </motion.p>

        <motion.h2
          {...fade(0.08)}
          id="hero-heading"
          className="font-display text-5xl md:text-6xl lg:text-7xl leading-[1.02] mb-6 tracking-tight bg-gradient-to-br from-white via-white to-indigo-200 bg-clip-text text-transparent"
        >
          <ScrambleText text={portfolio.identity.name} />
        </motion.h2>

        <motion.p {...fade(0.16)} className="text-xl md:text-2xl text-slate-300 font-medium mb-2">
          {portfolio.identity.title}
        </motion.p>

        <motion.p {...fade(0.18)} className="text-sm text-slate-500 mb-4">
          {portfolio.identity.school} · {portfolio.identity.location}
        </motion.p>

        <motion.p {...fade(0.24)} className="text-base text-slate-400 mb-10 max-w-2xl leading-relaxed">
          {portfolio.identity.tagline}
        </motion.p>

        <motion.div {...fade(0.3)} className="flex flex-wrap gap-3">
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
