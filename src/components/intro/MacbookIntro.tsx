import { useRef, useState } from 'react'
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { portfolio } from '../../data/portfolio'
import { useIntroViewport } from '../../hooks/useIntroViewport'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import {
  useIsPhoneLayout,
  useLightExperience,
  useTouchDevice,
} from '../../hooks/useTouchDevice'
import { MacbookScreenContent } from './MacbookScreenContent'

/** Phone — static open laptop (no 3D; iOS Safari breaks rotateX). Scroll fades into hero. */
function MobileMacbookIntro({
  scrollRef,
  scrollYProgress,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>
  scrollYProgress: MotionValue<number>
}) {
  const fade = useTransform(scrollYProgress, [0.55, 0.82], [1, 0], { clamp: true })
  const lift = useTransform(scrollYProgress, [0, 0.82], [0, -32])

  return (
    <div ref={scrollRef} className="relative h-[150vh]">
      <div className="sticky top-0 flex min-h-[100svh] flex-col items-center justify-center px-5 pt-14 pb-10">
        <motion.div
          style={{ opacity: fade, y: lift }}
          className="flex w-full max-w-md flex-col items-center gap-7"
        >
          <IntroTitle compact />

          <div className="w-full max-w-[18rem]">
            <div className="rounded-2xl border border-white/10 bg-[#0a0a10] p-2 shadow-2xl">
              <div className="aspect-[16/10] w-full rounded-xl overflow-hidden bg-[#16161d]">
                <MacbookScreenContent compact />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export function MacbookIntro() {
  const desktopRef = useRef<HTMLDivElement>(null)
  const mobileRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const light = useLightExperience()
  const touch = useTouchDevice()
  const phoneLayout = useIsPhoneLayout()
  const phone = touch || phoneLayout
  const { displayScale } = useIntroViewport()

  const scrollTarget = phone ? mobileRef : desktopRef
  const { scrollYProgress } = useScroll({
    target: scrollTarget,
    offset: ['start start', 'end start'],
  })

  const scaleX = useTransform(scrollYProgress, [0, 0.3], [1.2, 1.5])
  const scaleY = useTransform(scrollYProgress, [0, 0.3], [0.6, 1.5])
  const translate = useTransform(scrollYProgress, [0, 1], [0, 1500])
  const rotate = useTransform(scrollYProgress, [0.1, 0.12, 0.3], [-28, -28, 0])
  const textTranslate = useTransform(scrollYProgress, [0, 0.35], [0, -160])
  const textOpacity = useTransform(scrollYProgress, [0, 0.28], [1, 0])
  const glowOpacity = useTransform(scrollYProgress, [0, 0.25, 0.55], [0.35, 0.7, 0])
  const laptopOpacity = useTransform(scrollYProgress, [0.5, 0.72, 1], [1, 0, 0], {
    clamp: true,
  })

  const hintRef = useRef<HTMLParagraphElement>(null)
  const [hintVisible, setHintVisible] = useState(true)
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (light) {
      if (hintRef.current) hintRef.current.style.opacity = v < 0.05 ? '1' : '0'
      return
    }
    setHintVisible(v < 0.05)
  })

  if (reduced) {
    return (
      <section id="intro" data-mission-waypoint data-waypoint-side="center" aria-label="Introduction">
        <div className="min-h-screen flex flex-col items-center justify-center px-6 py-24 gap-12">
          <IntroTitle />
          <div className="w-[min(92vw,40rem)]">
            <div className="rounded-2xl border border-white/10 bg-[#0a0a10] p-2 shadow-2xl">
              <div className="aspect-[16/10] rounded-xl overflow-hidden">
                <MacbookScreenContent />
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      id="intro"
      data-mission-waypoint
      data-waypoint-side="center"
      className="relative"
      aria-label="Introduction"
    >
      {phone ? (
        <MobileMacbookIntro scrollRef={mobileRef} scrollYProgress={scrollYProgress} />
      ) : (
        <div
          ref={desktopRef}
          className="flex min-h-[200vh] shrink-0 flex-col items-center justify-start py-0 md:py-16"
          style={{
            scale: displayScale,
            transformOrigin: 'top center',
            perspective: '800px',
          }}
        >
          <motion.div
            style={{ translateY: textTranslate, opacity: textOpacity }}
            className="relative z-20 mb-10 md:mb-16 w-full px-6 pt-24 md:pt-28"
          >
            <IntroTitle />
          </motion.div>

          <motion.div
            style={{ opacity: laptopOpacity }}
            className="relative z-10 flex flex-col items-center"
          >
            <motion.div
              style={{ opacity: glowOpacity }}
              className="pointer-events-none absolute top-40 h-[26rem] w-[46rem] rounded-full bg-indigo-500/25 blur-[120px]"
              aria-hidden="true"
            />

            <DesktopLid
              scaleX={scaleX}
              scaleY={scaleY}
              rotate={rotate}
              translate={translate}
              progress={scrollYProgress}
            />

            <div className="relative -z-10 h-[22rem] w-[32rem] overflow-hidden rounded-2xl bg-gradient-to-b from-[#21212a] via-[#16161d] to-[#0c0c12] ring-1 ring-white/10">
              <div className="relative h-10 w-full">
                <div className="absolute inset-x-0 mx-auto h-4 w-[80%] rounded-b-lg bg-[#050507]" />
              </div>
              <div className="relative flex">
                <SpeakerGrid />
                <Keypad />
                <SpeakerGrid />
              </div>
              <Trackpad />
              <div className="absolute inset-x-0 bottom-0 mx-auto h-2 w-20 rounded-tl-3xl rounded-tr-3xl bg-gradient-to-t from-[#23232b] to-[#060608]" />
            </div>
          </motion.div>
        </div>
      )}

      {!phone && (
      <p
        ref={hintRef}
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 text-xs text-slate-500 m-0 transition-opacity duration-500 ${
          light ? '' : hintVisible ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      >
        <span className="inline-block h-5 w-3 rounded-full border border-slate-600">
          <span className="mx-auto mt-1 block h-1.5 w-0.5 animate-bounce rounded-full bg-slate-400" />
        </span>
        Scroll to open
      </p>
      )}
    </section>
  )
}

function IntroTitle({ compact = false }: { compact?: boolean }) {
  return (
    <div className="text-center max-w-3xl mx-auto">
      <p className="section-label mb-3">Aerospace Engineering Portfolio</p>
      <p
        className={`font-display font-semibold tracking-tight text-white mb-3 md:mb-5 ${compact ? 'text-3xl' : 'text-4xl sm:text-5xl md:text-6xl lg:text-7xl'}`}
      >
        {portfolio.identity.name}
      </p>
      <h1
        className={`font-display font-semibold tracking-tight leading-[1.05] text-white ${compact ? 'text-2xl' : 'text-3xl sm:text-4xl md:text-6xl lg:text-7xl'}`}
      >
        Engineering flight,
        <span className="block bg-gradient-to-r from-indigo-300 via-violet-300 to-indigo-200 bg-clip-text text-transparent pb-1">
          one mission at a time.
        </span>
      </h1>
      <p className="mt-4 md:mt-5 text-base md:text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
        {portfolio.identity.tagline}
      </p>
    </div>
  )
}

function DesktopLid({
  scaleX,
  scaleY,
  rotate,
  translate,
  progress,
}: {
  scaleX: MotionValue<number>
  scaleY: MotionValue<number>
  rotate: MotionValue<number>
  translate: MotionValue<number>
  progress: MotionValue<number>
}) {
  return (
    <div className="relative [perspective:800px]">
      <div
        style={{
          transform: 'perspective(800px) rotateX(-25deg) translateZ(0px)',
          transformOrigin: 'bottom',
          transformStyle: 'preserve-3d',
        }}
        className="relative h-[12rem] w-[32rem] rounded-2xl bg-[#08080c] p-2 ring-1 ring-white/10"
      >
        <div
          style={{ boxShadow: '0px 2px 0px 2px #16161d inset' }}
          className="absolute inset-0 flex items-center justify-center rounded-lg bg-[#08080c]"
        >
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
            <path d="M18 4 L23 20 L18 17 L13 20 Z" fill="url(#lid-logo)" />
            <ellipse cx="18" cy="26" rx="4" ry="2" fill="#6366f1" opacity="0.6" />
            <defs>
              <linearGradient id="lid-logo" x1="13" y1="4" x2="23" y2="20">
                <stop stopColor="#c7d2fe" />
                <stop offset="1" stopColor="#818cf8" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      <motion.div
        style={{
          scaleX,
          scaleY,
          rotateX: rotate,
          translateY: translate,
          transformStyle: 'preserve-3d',
          transformOrigin: 'top',
        }}
        className="absolute inset-0 h-96 w-[32rem] rounded-2xl bg-[#08080c] p-2 ring-1 ring-white/10"
      >
        <div className="absolute inset-0 rounded-lg bg-[#16161d]" />
        <div className="absolute inset-2 overflow-hidden rounded-lg">
          <MacbookScreenContent progress={progress} />
        </div>
      </motion.div>
    </div>
  )
}

function Trackpad() {
  return (
    <div
      className="mx-auto my-1 h-32 w-[40%] rounded-xl"
      style={{ boxShadow: '0px 0px 1px 1px #ffffff10 inset' }}
    />
  )
}

function SpeakerGrid() {
  return (
    <div
      className="mx-auto mt-2 h-40 w-[10%] overflow-hidden"
      style={{
        backgroundImage: 'radial-gradient(circle, #ffffff14 0.5px, transparent 0.5px)',
        backgroundSize: '3px 3px',
      }}
    />
  )
}

const KEY_ROWS: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.6],
  [1.6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [1, 1, 1, 1.2, 6.2, 1.2, 1, 1, 1],
]

function Keypad() {
  return (
    <div className="mx-1 h-full w-[80%] rounded-md bg-[#040406] p-1">
      {KEY_ROWS.map((row, ri) => (
        <div key={ri} className="mb-[3px] flex w-full gap-[3px]">
          {row.map((flex, ki) => (
            <div
              key={ki}
              style={{ flex }}
              className="h-7 rounded-[4px] bg-gradient-to-b from-[#17171d] to-[#0c0c10] shadow-[0_-0.5px_1px_0_rgba(255,255,255,0.12)_inset,0_1px_2px_0_rgba(0,0,0,0.6)]"
            />
          ))}
        </div>
      ))}
    </div>
  )
}
