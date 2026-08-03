import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ScrollTrigger } from '../../lib/scrollTrigger'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useMissionState } from '../../context/missionState'
import { SECTION_LABELS, type SectionId } from '../../data/portfolio'
import { AltimeterGauge } from '../hud/AltimeterGauge'
import { ArtificialHorizon } from '../hud/ArtificialHorizon'
import { AirspeedGauge } from '../hud/AirspeedGauge'

/**
 * Fixed cockpit HUD on the right edge: altimeter = page progress,
 * horizon + airspeed = scroll velocity, plus current mission phase
 * and a toast when a new waypoint is reached.
 */

/** A long pause must not integrate as one huge step. */
const MAX_DT = 0.05
/** Integration sub-step; keeps the springs stable at any frame rate. */
const SUB_STEP = 1 / 120

/** Scroll rate that reads as "full deflection" (px per second). */
const FULL_SCALE_RATE = 2400

interface Needle {
  x: number
  v: number
}

/**
 * A real needle has mass: it lags the input, then settles. Both gauges use a
 * damped spring rather than a raw assignment, but the damping ratios differ.
 * The altimeter is a precision readout and is critically damped, so it never
 * overshoots its own reading; the airspeed indicator is deliberately a touch
 * under-damped so it nods once on a hard scroll and settles, the way a real
 * pitot-driven needle does. Neither can ring forever - both snap to target
 * once position and velocity are inside a deadband, which is also what lets
 * the loop stop.
 */
function stepNeedle(n: Needle, target: number, stiffness: number, damping: number, dt: number) {
  let remaining = dt
  while (remaining > 0) {
    const h = remaining > SUB_STEP ? SUB_STEP : remaining
    remaining -= h
    const accel = -stiffness * (n.x - target) - damping * n.v
    n.v += accel * h
    n.x += n.v * h
  }
  if (Math.abs(n.x - target) < 0.0004 && Math.abs(n.v) < 0.002) {
    n.x = target
    n.v = 0
  }
}

function needleSettled(n: Needle, target: number): boolean {
  return n.x === target && n.v === 0
}

/** Frame-rate independent exponential approach. */
function damp(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt))
}

interface Instruments {
  alt: number
  att: number
  ias: number
}

const AT_REST: Instruments = { alt: 0, att: 0, ias: 0 }

/** Gauges arrive in sequence rather than as one block. */
const GAUGE_IN = { opacity: 0, x: 14 }
const GAUGE_TO = { opacity: 1, x: 0 }

export function MissionHUD() {
  const reduced = useReducedMotion()
  const hudVisible = useMediaQuery('(min-width: 1024px)', true)
  const { phase } = useMissionState()
  const [instruments, setInstruments] = useState<Instruments>(AT_REST)
  const [toast, setToast] = useState<string | null>(null)
  const prevPhase = useRef<string | null>(null)

  useEffect(() => {
    if (reduced || !hudVisible) return

    const alt: Needle = { x: 0, v: 0 }
    const ias: Needle = { x: 0, v: 0 }
    let att = 0
    let rawVelocity = 0

    // Cached page metrics: scrollHeight forces layout, so it is read here and
    // on resize/load only, never inside the scroll path or the frame loop.
    let docHeight = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    let lastY = window.scrollY
    let lastTime = 0
    let raf = 0
    let running = false
    let shown = AT_REST

    // Start the altimeter at the current altitude: landing on a deep link
    // should not sweep the needle up from zero.
    alt.x = Math.min(1, Math.max(0, lastY / docHeight))

    const frame = (now: number) => {
      const dt = Math.min(MAX_DT, Math.max(1 / 240, (now - lastTime) / 1000))
      lastTime = now

      const y = window.scrollY
      const rate = (y - lastY) / dt / FULL_SCALE_RATE
      lastY = y

      rawVelocity = damp(rawVelocity, Math.max(-1, Math.min(1, rate)), 8, dt)
      if (Math.abs(rawVelocity) < 0.0008) rawVelocity = 0

      // Attitude trails the velocity signal so the horizon rolls in and levels
      // out instead of tracking the wheel one-to-one.
      att = damp(att, rawVelocity, 6.5, dt)
      if (Math.abs(att) < 0.0006 && rawVelocity === 0) att = 0

      const altTarget = Math.min(1, Math.max(0, y / docHeight))
      const iasTarget = Math.min(1, Math.abs(rawVelocity) * 1.4)

      // Critically damped: 2 * sqrt(55) = 14.83, nudged past 1.0 for zero overshoot.
      stepNeedle(alt, altTarget, 55, 15.6, dt)
      // Damping ratio ~0.72: one small nod, then settled.
      stepNeedle(ias, iasTarget, 150, 17.6, dt)

      if (
        Math.abs(alt.x - shown.alt) > 0.0015 ||
        Math.abs(att - shown.att) > 0.0015 ||
        Math.abs(ias.x - shown.ias) > 0.0015
      ) {
        shown = { alt: alt.x, att, ias: ias.x }
        setInstruments(shown)
      }

      const idle =
        rawVelocity === 0 &&
        att === 0 &&
        needleSettled(alt, altTarget) &&
        needleSettled(ias, iasTarget)

      if (idle) {
        running = false
        return
      }

      raf = requestAnimationFrame(frame)
    }

    const wake = () => {
      if (running) return
      running = true
      // Reset the clock and the scroll baseline so the first frame after an
      // idle period measures a real delta rather than the whole pause.
      lastTime = performance.now()
      lastY = window.scrollY
      raf = requestAnimationFrame(frame)
    }

    const remeasure = () => {
      docHeight = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      wake()
    }

    window.addEventListener('scroll', wake, { passive: true })
    window.addEventListener('resize', remeasure)
    window.addEventListener('load', remeasure)
    ScrollTrigger.addEventListener('refresh', remeasure)
    const settle = window.setTimeout(remeasure, 1200)

    wake()

    return () => {
      cancelAnimationFrame(raf)
      running = false
      window.clearTimeout(settle)
      window.removeEventListener('scroll', wake)
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('load', remeasure)
      ScrollTrigger.removeEventListener('refresh', remeasure)
    }
  }, [reduced, hudVisible])

  // Waypoint-reached toast on phase change (skip initial mount)
  useEffect(() => {
    if (prevPhase.current === null) {
      prevPhase.current = phase
      return
    }
    if (phase === prevPhase.current) return
    prevPhase.current = phase

    const label = SECTION_LABELS[phase as SectionId] ?? phase
    setToast(label)
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [phase])

  if (reduced || !hudVisible) return null

  const { alt, att, ias } = instruments
  const phaseLabel =
    phase === 'contact' ? 'Touchdown' : (SECTION_LABELS[phase as SectionId] ?? phase)

  return (
    <div
      className="fixed right-4 top-1/2 -translate-y-1/2 hidden lg:flex flex-col items-center gap-3 pointer-events-none"
      style={{ zIndex: 'var(--z-hud)' }}
      aria-hidden="true"
    >
      <div className="relative flex flex-col items-center gap-2 rounded-2xl border border-white/[0.06] bg-[rgba(8,8,14,0.55)] backdrop-blur-md p-2.5 opacity-90">
        <motion.div
          initial={GAUGE_IN}
          animate={GAUGE_TO}
          transition={{ duration: 0.5, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        >
          <AltimeterGauge value={alt} size={60} />
        </motion.div>
        <motion.div
          initial={GAUGE_IN}
          animate={GAUGE_TO}
          transition={{ duration: 0.5, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
        >
          <ArtificialHorizon pitch={att * 0.55} roll={att * 14} size={60} />
        </motion.div>
        <motion.div
          initial={GAUGE_IN}
          animate={GAUGE_TO}
          transition={{ duration: 0.5, delay: 0.23, ease: [0.22, 1, 0.36, 1] }}
        >
          <AirspeedGauge value={ias} size={60} />
        </motion.div>

        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-full top-1/2 -translate-y-1/2 mr-3 whitespace-nowrap rounded-full border border-indigo-400/30 bg-[rgba(10,10,18,0.85)] px-3.5 py-1.5 backdrop-blur-md"
            >
              <span className="text-[10px] font-medium tracking-[0.2em] text-indigo-200 uppercase">
                Waypoint - {toast}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative h-28 w-px bg-white/10 rounded-full overflow-hidden">
        <div
          className="absolute bottom-0 left-0 w-full rounded-full bg-gradient-to-t from-indigo-500 to-violet-300"
          style={{ height: `${alt * 100}%` }}
        />
      </div>

      <span className="text-[9px] font-medium tracking-[0.22em] text-slate-500 uppercase [writing-mode:vertical-rl] rotate-180">
        {phaseLabel} · {Math.round(alt * 100)}%
      </span>
    </div>
  )
}
