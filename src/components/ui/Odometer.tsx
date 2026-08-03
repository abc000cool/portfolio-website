import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

interface OdometerProps {
  value: number
  suffix?: string
  delay?: number
  active?: boolean
  static?: boolean
}

/**
 * Total count-up time. Matches the pacing of the old 30 frames x 30ms interval
 * exactly - this is a retiming of *how* the number arrives, not how long it
 * takes to get there.
 */
const COUNT_DURATION = 900

function Digit({
  target,
  active,
  delay,
  static: staticValue,
}: {
  target: number
  active: boolean
  delay: number
  static?: boolean
}) {
  const reduced = useReducedMotion()
  // Static stats and reduced-motion readers skip the count-up. Both cases used
  // to be a setState inside the effect, which cost an extra render pass and
  // briefly painted 0 before snapping to the real number.
  const skipCountUp = Boolean(staticValue) || reduced
  const [current, setCurrent] = useState(skipCountUp ? target : 0)
  const [lastSnapshot, setLastSnapshot] = useState(`${target}|${skipCountUp}`)
  const started = useRef(false)

  const snapshot = `${target}|${skipCountUp}`
  if (snapshot !== lastSnapshot) {
    setLastSnapshot(snapshot)
    if (skipCountUp) setCurrent(target)
  }

  useEffect(() => {
    if (skipCountUp) return
    if (!active || started.current) return

    started.current = true

    let raf = 0
    let startedAt = 0
    let painted = -1

    const step = (now: number) => {
      if (startedAt === 0) startedAt = now
      const p = Math.min(1, (now - startedAt) / COUNT_DURATION)

      // Ease-out cubic. The readout covers most of its range immediately and
      // then drifts the last few units in, so it decelerates into the final
      // value instead of stopping dead on it.
      const eased = 1 - Math.pow(1 - p, 3)

      // Land on the exact target on the terminal frame rather than trusting
      // rounding to get there - a stat that settles on 11 of 12 is worse than
      // no animation at all.
      const next = p === 1 ? target : Math.round(eased * target)

      // The tail of an ease-out rounds to the same integer for many frames in
      // a row. Re-rendering with an unchanged number is what makes digits look
      // like they are shivering in place at the end; skip those frames.
      if (next !== painted) {
        painted = next
        setCurrent(next)
      }

      if (p < 1) raf = requestAnimationFrame(step)
    }

    // Timed off rAF rather than setInterval: a 30ms interval is not aligned to
    // the display, so on a 144Hz panel the number stepped in visible chunks
    // while everything around it moved smoothly.
    const timeout = setTimeout(() => {
      raf = requestAnimationFrame(step)
    }, delay)

    return () => {
      clearTimeout(timeout)
      cancelAnimationFrame(raf)
    }
  }, [active, target, delay, skipCountUp])

  const digits = String(current).padStart(String(target).length, '0')

  return (
    <span className="inline-flex overflow-hidden h-[1.2em] font-display text-4xl md:text-5xl font-semibold text-white tracking-tight">
      {digits.split('').map((d, i) => (
        <span key={i} className="inline-block">
          {d}
        </span>
      ))}
    </span>
  )
}

export function Odometer({
  value,
  suffix = '',
  delay = 0,
  active = false,
  static: staticValue = false,
}: OdometerProps) {
  return (
    <div className="flex items-baseline gap-1">
      <Digit target={value} active={active} delay={delay} static={staticValue} />
      {suffix && (
      <span className="font-body text-sm text-slate-500">{suffix}</span>
      )}
    </div>
  )
}
