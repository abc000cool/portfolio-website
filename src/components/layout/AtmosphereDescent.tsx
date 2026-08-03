import { useEffect, useRef } from 'react'
import { ScrollTrigger } from '../../lib/scrollTrigger'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useLightExperience } from '../../hooks/useTouchDevice'

/** A long pause must not integrate as one huge step. */
const MAX_DT = 0.05
/** Follow rate in e-foldings per second - slow, this is weather, not UI. */
const DESCENT_RATE = 2.6
const MAX_DESCENT_OPACITY = 0.55

/** Ease-in-out so the descent starts and ends without a visible corner. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Static atmosphere for mobile/Safari - no scroll-driven React updates. */
export function AtmosphereDescent() {
  const reduced = useReducedMotion()
  const light = useLightExperience()
  const descentRef = useRef<HTMLDivElement>(null)

  /**
   * The lower-atmosphere layer is cross-faded rather than recoloured. Writing
   * a new `background` string per frame would restyle and repaint a
   * full-screen gradient; opacity on a promoted layer is a compositor-only
   * change. It is also one continuous interpolation over the whole document,
   * so there are no per-section beats to step between.
   */
  useEffect(() => {
    if (reduced || light) return
    const el = descentRef.current
    if (!el) return

    // scrollHeight forces layout, so it is cached and refreshed on layout
    // events only, never read inside the scroll handler or the frame loop.
    let docHeight = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    let current = Math.min(1, Math.max(0, window.scrollY / docHeight))
    let applied = -1
    let last = 0
    let raf = 0
    let running = false

    const paint = () => {
      const next = smoothstep(current) * MAX_DESCENT_OPACITY
      if (Math.abs(next - applied) < 0.002) return
      applied = next
      el.style.opacity = next.toFixed(3)
    }

    const frame = (now: number) => {
      const dt = Math.min(MAX_DT, Math.max(0, (now - last) / 1000))
      last = now

      const target = Math.min(1, Math.max(0, window.scrollY / docHeight))
      current += (target - current) * (1 - Math.exp(-DESCENT_RATE * dt))
      if (Math.abs(target - current) < 0.0005) current = target

      paint()

      if (current === target) {
        running = false
        return
      }
      raf = requestAnimationFrame(frame)
    }

    const wake = () => {
      if (running) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }

    const remeasure = () => {
      docHeight = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      wake()
    }

    paint()

    window.addEventListener('scroll', wake, { passive: true })
    window.addEventListener('resize', remeasure)
    window.addEventListener('load', remeasure)
    ScrollTrigger.addEventListener('refresh', remeasure)
    const settle = window.setTimeout(remeasure, 1200)

    return () => {
      cancelAnimationFrame(raf)
      running = false
      window.clearTimeout(settle)
      window.removeEventListener('scroll', wake)
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('load', remeasure)
      ScrollTrigger.removeEventListener('refresh', remeasure)
    }
  }, [reduced, light])

  if (reduced) {
    return (
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
        aria-hidden="true"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 20% -10%, rgba(99,102,241,0.15), transparent 50%)',
          }}
        />
      </div>
    )
  }

  if (light) {
    return (
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
        aria-hidden="true"
      >
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 85% 55% at 22% -8%, rgba(99,102,241,0.22), transparent 58%),
              radial-gradient(ellipse 70% 50% at 78% 35%, rgba(129,140,248,0.12), transparent 52%),
              linear-gradient(180deg, rgb(6,6,10) 0%, rgb(10,10,16) 50%, rgb(12,11,14) 100%)
            `,
          }}
        />
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 85% 55% at 22% -8%, rgba(99,102,241,0.24), transparent 58%),
            radial-gradient(ellipse 70% 50% at 78% 35%, rgba(129,140,248,0.14), transparent 52%),
            linear-gradient(180deg, rgb(6,6,10) 0%, rgb(10,10,18) 45%, rgb(14,12,12) 100%)
          `,
          opacity: 0.65,
        }}
      />
      {/*
        Lower atmosphere: identical palette, warmed and deepened toward the
        bottom of the frame. Starts fully transparent, so the top of the page
        is pixel-identical to before.
      */}
      <div
        ref={descentRef}
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 100% 55% at 50% 118%, rgba(129,140,248,0.10), transparent 60%),
            linear-gradient(180deg, rgba(6,6,10,0) 0%, rgba(20,15,14,0.45) 55%, rgba(28,18,15,0.72) 100%)
          `,
          opacity: 0,
          willChange: 'opacity',
        }}
      />
    </div>
  )
}
