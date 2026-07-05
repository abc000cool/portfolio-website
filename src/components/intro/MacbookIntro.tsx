import { useEffect, useRef, useState } from 'react'
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

export function MacbookIntro() {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const light = useLightExperience()
  const touch = useTouchDevice()
  const isMobile = useIsPhoneLayout()
  const { displayScale } = useIntroViewport()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })

  const lidEnd = isMobile ? 0.42 : 0.3
  const fadeStart = isMobile ? 0.3 : 0.5
  const fadeMid = isMobile ? 0.4 : 0.72
  const translateEnd = isMobile ? 0.9 : 1
  const translateMax = isMobile ? 360 : 1500
  const peakLidScale = isMobile ? 1 : 1.5

  const scaleX = useTransform(scrollYProgress, [0, lidEnd], [1.2, peakLidScale])
  const scaleY = useTransform(scrollYProgress, [0, lidEnd], [0.6, peakLidScale])
  const translate = useTransform(scrollYProgress, [0, translateEnd], [0, translateMax])
  const rotate = useTransform(
    scrollYProgress,
    [0.1, 0.12, lidEnd],
    isMobile ? [-14, -14, 0] : [-28, -28, 0],
  )
  const backShellOpacity = useTransform(scrollYProgress, [0, touch ? 0.22 : 0.12], [1, 0])
  const textTranslate = useTransform(scrollYProgress, [0, isMobile ? 0.32 : 0.35], [0, -120])
  const textOpacity = useTransform(scrollYProgress, [0, isMobile ? 0.22 : 0.28], [1, 0])
  const glowOpacity = useTransform(
    scrollYProgress,
    [0, 0.25, isMobile ? 0.45 : 0.55],
    [0.35, 0.7, 0],
  )
  const laptopOpacity = useTransform(
    scrollYProgress,
    [fadeStart, fadeMid, isMobile ? 0.88 : 1],
    [1, 0, 0],
    { clamp: true },
  )
  const laptopLift = useTransform(scrollYProgress, [fadeStart, fadeMid], [0, isMobile ? -16 : 0])

  const laptopWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isMobile) return
    const apply = (v: number) => {
      const fade = 1 - Math.min(1, Math.max(0, (v - fadeStart) / (fadeMid - fadeStart)))
      if (laptopWrapRef.current) {
        laptopWrapRef.current.style.opacity = String(fade)
        laptopWrapRef.current.style.pointerEvents = fade < 0.05 ? 'none' : ''
      }
    }
    apply(scrollYProgress.get())
    return scrollYProgress.on('change', apply)
  }, [isMobile, scrollYProgress, fadeStart, fadeMid])

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

  const laptopScene = (
    <div
      className="flex w-full flex-col items-center"
      style={
        isMobile
          ? undefined
          : {
              scale: displayScale,
              transformOrigin: 'top center',
            }
      }
    >
      <motion.div
        style={{ translateY: textTranslate, opacity: textOpacity }}
        className={`relative z-20 w-full px-5 ${isMobile ? 'mb-4 pt-16' : 'mb-8 md:mb-16 px-6 pt-20 md:pt-28'}`}
      >
        <IntroTitle compact={isMobile} />
      </motion.div>

      {isMobile ? (
        <div
          ref={laptopWrapRef}
          style={{ opacity: 1 }}
          className="relative z-10 flex flex-col items-center w-full"
        >
          <MobileMacbook progress={scrollYProgress} />
        </div>
      ) : (
        <motion.div
          style={{ opacity: laptopOpacity, translateY: laptopLift }}
          className="relative z-10 flex flex-col items-center w-full"
        >
          {!touch && (
            <motion.div
              style={{ opacity: glowOpacity }}
              className="pointer-events-none absolute top-40 rounded-full bg-indigo-500/25 h-[26rem] w-[46rem] blur-[120px]"
              aria-hidden="true"
            />
          )}

          <DesktopLid
            scaleX={scaleX}
            scaleY={scaleY}
            rotate={rotate}
            translate={translate}
            backShellOpacity={backShellOpacity}
            progress={scrollYProgress}
          />

          <div className="relative -z-10 h-[22rem] w-[min(92vw,32rem)] overflow-hidden rounded-2xl bg-gradient-to-b from-[#21212a] via-[#16161d] to-[#0c0c12] ring-1 ring-white/10">
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
      )}
    </div>
  )

  return (
    <section
      id="intro"
      data-mission-waypoint
      data-waypoint-side="center"
      className="relative z-20 isolate"
      aria-label="Introduction"
    >
      <div
        ref={ref}
        className={
          isMobile
            ? 'relative h-[175vh]'
            : 'flex min-h-[200vh] shrink-0 flex-col items-center justify-start py-0 md:py-16 [perspective:800px]'
        }
      >
        {isMobile ? (
          <div className="sticky top-0 flex min-h-[100svh] max-h-[100svh] flex-col items-center justify-center overflow-hidden px-3">
            {laptopScene}
          </div>
        ) : (
          laptopScene
        )}
      </div>

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
    </section>
  )
}

function IntroTitle({ compact = false }: { compact?: boolean }) {
  return (
    <div className="text-center max-w-3xl mx-auto">
      <p className={`section-label ${compact ? 'mb-2' : 'mb-3'}`}>Aerospace Engineering Portfolio</p>
      <p
        className={`font-display font-semibold tracking-tight text-white ${compact ? 'text-[1.65rem] leading-tight mb-2' : 'text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-3 md:mb-5'}`}
      >
        {portfolio.identity.name}
      </p>
      <h1
        className={`font-display font-semibold tracking-tight leading-[1.05] text-white ${compact ? 'text-xl' : 'text-3xl sm:text-4xl md:text-6xl lg:text-7xl'}`}
      >
        Engineering flight,
        <span className="block bg-gradient-to-r from-indigo-300 via-violet-300 to-indigo-200 bg-clip-text text-transparent pb-1">
          one mission at a time.
        </span>
      </h1>
      {!compact && (
        <p className="mt-4 md:mt-5 text-base md:text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
          {portfolio.identity.tagline}
        </p>
      )}
    </div>
  )
}

/** Unified mobile MacBook — closed screen crossfades to dashboard; no overlay squash. */
function MobileMacbook({ progress }: { progress: MotionValue<number> }) {
  const unitRef = useRef<HTMLDivElement>(null)
  const closedRef = useRef<HTMLDivElement>(null)
  const openRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const apply = (v: number) => {
      const closedT = 1 - Math.min(1, v / 0.18)
      const openT = Math.min(1, Math.max(0, (v - 0.02) / 0.14))
      const scale = 1 + Math.min(0.03, Math.max(0, (v - 0.28) / 0.2) * 0.03)

      if (closedRef.current) closedRef.current.style.opacity = String(closedT)
      if (openRef.current) openRef.current.style.opacity = String(openT)
      if (unitRef.current) {
        unitRef.current.style.transform = `scale(${scale})`
      }
    }
    apply(progress.get())
    return progress.on('change', apply)
  }, [progress])

  return (
    <div
      ref={unitRef}
      className="relative w-[min(88vw,19.5rem)] will-change-transform"
      data-testid="mobile-lid"
      style={{ transform: 'scale(1)' }}
    >
      {/* Screen lid */}
      <div
        className="relative z-10 rounded-t-xl bg-[#08080c] px-2 pt-2 pb-1.5 ring-1 ring-white/10 shadow-[0_12px_32px_rgba(0,0,0,0.4)]"
        data-testid="mobile-screen-frame"
      >
        <div className="mx-auto mb-1.5 h-1 w-10 rounded-full bg-[#050507] ring-1 ring-white/[0.06]" aria-hidden="true" />

        <div className="relative aspect-[16/10] w-full rounded-md overflow-hidden bg-[#16161d] ring-1 ring-white/[0.06]">
          <div ref={openRef} className="absolute inset-0" style={{ opacity: 0 }}>
            <MacbookScreenContent progress={progress} compact />
          </div>

          {/* Closed — proper MacBook sleep screen */}
          <div
            ref={closedRef}
            className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#0a0a10] via-[#08080c] to-[#12121a]"
            style={{ opacity: 1 }}
            data-testid="mobile-closed-screen"
          >
            <div
              className="absolute inset-0 rounded-md"
              style={{ boxShadow: '0px 2px 0px 2px #16161d inset' }}
              aria-hidden="true"
            />
            <LidLogo size={32} />
          </div>

          {/* Glass sheen */}
          <div
            className="pointer-events-none absolute inset-0 rounded-md"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 42%, transparent 58%, rgba(255,255,255,0.03) 100%)',
            }}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Keyboard base — flush with lid */}
      <div className="relative -mt-px overflow-hidden rounded-b-xl bg-gradient-to-b from-[#21212a] via-[#16161d] to-[#0c0c12] ring-1 ring-white/10 ring-t-0 pb-1.5">
        <div className="relative h-6 w-full">
          <div className="absolute inset-x-0 mx-auto h-2.5 w-[78%] rounded-b-md bg-[#050507]" />
        </div>
        <div className="relative flex px-0.5">
          <SpeakerGrid compact />
          <Keypad compact />
          <SpeakerGrid compact />
        </div>
        <Trackpad compact />
        <div className="absolute inset-x-0 bottom-0 mx-auto h-1 w-14 rounded-tl-2xl rounded-tr-2xl bg-gradient-to-t from-[#23232b] to-[#060608]" />
      </div>
    </div>
  )
}

function DesktopLid({
  scaleX,
  scaleY,
  rotate,
  translate,
  backShellOpacity,
  progress,
}: {
  scaleX: MotionValue<number>
  scaleY: MotionValue<number>
  rotate: MotionValue<number>
  translate: MotionValue<number>
  backShellOpacity: MotionValue<number>
  progress: MotionValue<number>
}) {
  return (
    <div className="relative [perspective:800px]" style={{ width: 'min(92vw, 32rem)', minHeight: '24rem' }}>
      <motion.div style={{ opacity: backShellOpacity }} className="relative z-0">
        <div
          style={{
            transform: 'perspective(800px) rotateX(-25deg) translateZ(0px)',
            transformOrigin: 'bottom',
            transformStyle: 'preserve-3d',
          }}
          className="relative h-[10rem] md:h-[12rem] w-full rounded-2xl bg-[#08080c] p-2 ring-1 ring-white/10"
        >
          <div
            style={{ boxShadow: '0px 2px 0px 2px #16161d inset' }}
            className="absolute inset-0 flex items-center justify-center rounded-lg bg-[#08080c]"
          >
            <LidLogo />
          </div>
        </div>
      </motion.div>

      <motion.div
        style={{
          scaleX,
          scaleY,
          rotateX: rotate,
          translateY: translate,
          transformStyle: 'preserve-3d',
          transformOrigin: 'top center',
        }}
        className="absolute left-0 right-0 top-0 z-10 h-80 md:h-96 w-full rounded-2xl bg-[#08080c] p-2 ring-1 ring-white/10"
      >
        <div className="absolute inset-0 rounded-lg bg-[#16161d]" />
        <div className="absolute inset-2 overflow-hidden rounded-lg">
          <MacbookScreenContent progress={progress} />
        </div>
      </motion.div>
    </div>
  )
}

function LidLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <path d="M18 4 L23 20 L18 17 L13 20 Z" fill="url(#lid-logo)" />
      <ellipse cx="18" cy="26" rx="4" ry="2" fill="#6366f1" opacity="0.6" />
      <defs>
        <linearGradient id="lid-logo" x1="13" y1="4" x2="23" y2="20">
          <stop stopColor="#c7d2fe" />
          <stop offset="1" stopColor="#818cf8" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function Trackpad({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`mx-auto rounded-xl ${compact ? 'my-0.5 h-14 w-[42%]' : 'my-1 h-32 w-[40%]'}`}
      style={{ boxShadow: '0px 0px 1px 1px #ffffff10 inset' }}
    />
  )
}

function SpeakerGrid({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`mx-auto overflow-hidden ${compact ? 'mt-1 h-24 w-[10%]' : 'mt-2 h-40 w-[10%]'}`}
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

const KEY_ROWS_COMPACT: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1.4, 1, 1, 1, 1, 1, 1, 1, 1.4],
  [1, 1, 1, 4, 1, 1, 1],
]

function Keypad({ compact = false }: { compact?: boolean }) {
  const rows = compact ? KEY_ROWS_COMPACT : KEY_ROWS
  return (
    <div className="mx-1 h-full w-[80%] rounded-md bg-[#040406] p-1">
      {rows.map((row, ri) => (
        <div key={ri} className="mb-[3px] flex w-full gap-[3px]">
          {row.map((flex, ki) => (
            <div
              key={ki}
              style={{ flex }}
              className={`rounded-[4px] bg-gradient-to-b from-[#17171d] to-[#0c0c10] shadow-[0_-0.5px_1px_0_rgba(255,255,255,0.12)_inset,0_1px_2px_0_rgba(0,0,0,0.6)] ${compact ? 'h-4' : 'h-7'}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
