import { useCallback, useEffect, useRef, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { initLenis, destroyLenis, scrollToSection } from '../lib/lenis'
import { ScrollTrigger } from '../lib/scrollTrigger'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useKonamiCode } from '../hooks/useKonamiCode'
import { useLaunchCode } from '../hooks/useLaunchCode'
import { MissionProvider, useWaypointReached } from '../context/MissionContext'

import { Starfield } from '../components/layout/Starfield'
import { AtmosphereDescent } from '../components/layout/AtmosphereDescent'
import { FlightPath } from '../components/layout/FlightPath'
import { MissionHUD } from '../components/layout/MissionHUD'
import { SiteNav } from '../components/layout/SiteNav'
import { CustomCursor } from '../components/layout/CustomCursor'
import { ParallaxLayers } from '../components/layout/ParallaxLayers'
import { MacbookIntro } from '../components/intro/MacbookIntro'

import { LaunchSequence } from '../components/easter-eggs/LaunchSequence'
import { HyperspaceWarp } from '../components/easter-eggs/HyperspaceWarp'
import { HeroSection } from '../sections/HeroSection'
import { AboutSection } from '../sections/AboutSection'
import { ProjectsSection } from '../sections/ProjectsSection'
import { ResearchSection } from '../sections/ResearchSection'
import { IsmSection } from '../sections/IsmSection'
import { StatsSection } from '../sections/StatsSection'
import { ContactSection } from '../sections/ContactSection'
import { portfolio } from '../data/portfolio'

function ParallaxBack() {
  return (
    <div
      className="absolute inset-[-15%] opacity-[0.045]"
      style={{
        backgroundImage:
          'linear-gradient(rgba(129,140,248,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(129,140,248,0.6) 1px, transparent 1px)',
        backgroundSize: '90px 90px',
      }}
    />
  )
}

const MID_MARKERS = [
  { left: '8%', top: '18%' },
  { left: '88%', top: '12%' },
  { left: '14%', top: '46%' },
  { left: '92%', top: '58%' },
  { left: '6%', top: '78%' },
  { left: '84%', top: '88%' },
]

function ParallaxMid() {
  return (
    <div className="absolute inset-[-15%]">
      {MID_MARKERS.map((pos, i) => (
        <span
          key={i}
          className="absolute font-mono text-indigo-300/[0.08] select-none"
          style={{ ...pos, fontSize: i % 2 === 0 ? '1.4rem' : '1rem' }}
        >
          +
        </span>
      ))}
    </div>
  )
}

function FlightLogLine() {
  const complete = useWaypointReached('contact')
  return (
    <p className="font-mono text-[11px] tracking-wider text-slate-600 m-0">
      {complete
        ? `MISSION COMPLETE — ${new Date().toISOString().slice(0, 10)} — ALL SYSTEMS NOMINAL`
        : 'MISSION IN PROGRESS — TELEMETRY NOMINAL'}
    </p>
  )
}

export function HomePage() {
  const reduced = useReducedMotion()
  const mainRef = useRef<HTMLElement>(null)
  const [launchActive, setLaunchActive] = useState(false)
  const [warpActive, setWarpActive] = useState(false)
  useEffect(() => {
    initLenis(reduced)

    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener('load', refresh)
    const t = setTimeout(refresh, 600)

    const hash = window.location.hash.slice(1)
    if (hash) {
      const hashTimer = setTimeout(() => scrollToSection(hash), 400)
      return () => {
        window.removeEventListener('load', refresh)
        clearTimeout(t)
        clearTimeout(hashTimer)
        destroyLenis()
        ScrollTrigger.getAll().forEach((st) => st.kill())
      }
    }

    return () => {
      window.removeEventListener('load', refresh)
      clearTimeout(t)
      destroyLenis()
      ScrollTrigger.getAll().forEach((st) => st.kill())
    }
  }, [reduced])

  const handleLaunch = useCallback(() => {
    if (!reduced) setLaunchActive(true)
  }, [reduced])

  const handleWarp = useCallback(() => {
    if (!reduced) setWarpActive(true)
  }, [reduced])

  useLaunchCode(handleLaunch, !reduced)
  useKonamiCode(handleWarp, !reduced)

  return (
    <MotionConfig reducedMotion="user">
      <MissionProvider>
        <a href="#intro" className="skip-link">
          Skip to content
        </a>

        <Starfield />
        <AtmosphereDescent />
        <MissionHUD />
        <CustomCursor />
        <SiteNav />

        <main id="main-content" ref={mainRef} className="relative">
          <FlightPath containerRef={mainRef} />

          <ParallaxLayers back={<ParallaxBack />} mid={<ParallaxMid />}>
            <MacbookIntro />
            <HeroSection />
            <AboutSection />
            <ProjectsSection />
            <ResearchSection />
            <IsmSection />
            <StatsSection />
            <ContactSection />
          </ParallaxLayers>

          <footer className="relative z-10 py-14 px-6 border-t border-white/[0.05]">
            <div className="max-w-6xl mx-auto flex flex-col gap-6">
              <FlightLogLine />
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-sm text-slate-500">
                  © {new Date().getFullYear()} {portfolio.identity.name}
                </p>
                <div className="flex items-center gap-6">
                  {portfolio.identity.socials.map((s) => (
                    <a key={s.label} href={s.url} className="link-underline text-sm text-slate-400">
                      {s.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </footer>
        </main>

        <LaunchSequence active={launchActive} onComplete={() => setLaunchActive(false)} />
        <HyperspaceWarp active={warpActive} onComplete={() => setWarpActive(false)} />
      </MissionProvider>
    </MotionConfig>
  )
}
