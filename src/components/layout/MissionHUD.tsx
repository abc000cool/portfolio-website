import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useScrollProgress } from '../../hooks/useScrollProgress'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useMissionState } from '../../context/missionState'
import { SECTION_LABELS, type SectionId } from '../../data/portfolio'
import { AltimeterGauge } from '../hud/AltimeterGauge'

/**
 * Fixed cockpit readout in the right gutter: altitude = page progress, plus the
 * current mission phase and a short arrival note when a waypoint is crossed.
 *
 * It used to also carry an artificial horizon and an airspeed gauge, both fed
 * by smoothed scroll velocity — instruments reporting nothing about the page,
 * redrawn from a requestAnimationFrame loop that never stopped. Progress is the
 * one reading here that means something, and it is driven by scroll events, so
 * the HUD costs nothing while the page is still.
 *
 * Gated at 1280px: below that the right gutter is narrower than this column and
 * the readout would sit on top of the content.
 */
export function MissionHUD() {
  const reduced = useReducedMotion()
  const hudVisible = useMediaQuery('(min-width: 1280px)', true)
  const progress = useScrollProgress(!reduced && hudVisible)
  const { phase } = useMissionState()
  const [arrival, setArrival] = useState<string | null>(null)
  const prevPhase = useRef<string | null>(null)

  // Waypoint-reached note on phase change (skip initial mount)
  useEffect(() => {
    if (prevPhase.current === null) {
      prevPhase.current = phase
      return
    }
    if (phase === prevPhase.current) return
    prevPhase.current = phase

    setArrival(SECTION_LABELS[phase as SectionId] ?? phase)
    const t = setTimeout(() => setArrival(null), 2200)
    return () => clearTimeout(t)
  }, [phase])

  if (reduced || !hudVisible) return null

  const phaseLabel =
    phase === 'contact' ? 'Touchdown' : (SECTION_LABELS[phase as SectionId] ?? phase)

  return (
    <div
      className="fixed right-4 top-1/2 -translate-y-1/2 hidden xl:flex w-[76px] flex-col items-center gap-2.5 pointer-events-none"
      style={{ zIndex: 'var(--z-hud)' }}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center rounded-2xl border border-white/[0.06] bg-[rgba(8,8,14,0.55)] backdrop-blur-md p-2.5 opacity-90">
        <AltimeterGauge value={progress} size={56} />
      </div>

      {/*
        Stacked under the gauge rather than flown out to the left: the old toast
        was absolutely positioned at `right-full`, which put it straight over the
        award card copy every time the stats waypoint was crossed.
      */}
      <div className="h-9 w-full">
        <AnimatePresence>
          {arrival && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="w-full rounded-lg border border-indigo-400/25 bg-[rgba(10,10,18,0.88)] px-1.5 py-1 text-center backdrop-blur-md"
            >
              <span className="block text-[11px] leading-tight tracking-[0.14em] text-slate-500 uppercase">
                WPT
              </span>
              <span className="block text-[11px] leading-tight font-medium text-indigo-200 truncate">
                {arrival}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative h-24 w-px bg-white/10 rounded-full overflow-hidden">
        <div
          className="absolute bottom-0 left-0 w-full rounded-full bg-gradient-to-t from-indigo-500 to-violet-300"
          style={{ height: `${progress * 100}%` }}
        />
      </div>

      <span className="text-[11px] font-medium tracking-[0.18em] text-slate-500 uppercase [writing-mode:vertical-rl] rotate-180">
        {phaseLabel} · {Math.round(progress * 100)}%
      </span>
    </div>
  )
}
