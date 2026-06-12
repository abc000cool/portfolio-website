import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useScrollProgress } from '../../hooks/useScrollProgress'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useMissionState } from '../../context/MissionContext'
import { SECTION_LABELS, type SectionId } from '../../data/portfolio'
import { AltimeterGauge } from '../hud/AltimeterGauge'
import { ArtificialHorizon } from '../hud/ArtificialHorizon'
import { AirspeedGauge } from '../hud/AirspeedGauge'

/**
 * Fixed cockpit HUD on the right edge: altimeter = page progress,
 * horizon + airspeed = scroll velocity, plus current mission phase
 * and a toast when a new waypoint is reached.
 */
export function MissionHUD() {
  const reduced = useReducedMotion()
  const progress = useScrollProgress()
  const { phase } = useMissionState()
  const [velocity, setVelocity] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const prevPhase = useRef<string | null>(null)

  // Smoothed signed scroll velocity (-1..1) drives horizon pitch/roll and airspeed
  useEffect(() => {
    if (reduced) return

    let raf = 0
    let v = 0
    let shown = 0
    let lastY = window.scrollY

    const loop = () => {
      const y = window.scrollY
      const target = Math.max(-1, Math.min(1, (y - lastY) / 40))
      lastY = y
      v += (target - v) * 0.1
      if (Math.abs(v - shown) > 0.004) {
        shown = v
        setVelocity(v)
      }
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [reduced])

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

  if (reduced) return null

  const phaseLabel =
    phase === 'contact' ? 'Touchdown' : (SECTION_LABELS[phase as SectionId] ?? phase)

  return (
    <div
      className="fixed right-4 top-1/2 -translate-y-1/2 hidden lg:flex flex-col items-center gap-3 pointer-events-none"
      style={{ zIndex: 'var(--z-hud)' }}
      aria-hidden="true"
    >
      <div className="relative flex flex-col items-center gap-2 rounded-2xl border border-white/[0.06] bg-[rgba(8,8,14,0.55)] backdrop-blur-md p-2.5 opacity-90">
        <AltimeterGauge value={progress} size={60} />
        <ArtificialHorizon pitch={velocity * 0.55} roll={velocity * 14} size={60} />
        <AirspeedGauge value={Math.min(1, Math.abs(velocity) * 1.4)} size={60} />

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
                Waypoint — {toast}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative h-28 w-px bg-white/10 rounded-full overflow-hidden">
        <div
          className="absolute bottom-0 left-0 w-full rounded-full bg-gradient-to-t from-indigo-500 to-violet-300"
          style={{ height: `${progress * 100}%` }}
        />
      </div>

      <span className="text-[9px] font-medium tracking-[0.22em] text-slate-500 uppercase [writing-mode:vertical-rl] rotate-180">
        {phaseLabel} · {Math.round(progress * 100)}%
      </span>
    </div>
  )
}
