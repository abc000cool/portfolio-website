import { useEffect } from 'react'
import { useScrollProgress } from '../../hooks/useScrollProgress'
import { useReducedMotion } from '../../hooks/useReducedMotion'

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Smoothstep between two progress thresholds. */
function band(progress: number, start: number, end: number): number {
  if (progress <= start) return 0
  if (progress >= end) return 1
  const t = (progress - start) / (end - start)
  return t * t * (3 - 2 * t)
}

/**
 * Scroll-driven atmospheric layers: deep space at the top warming into
 * indigo haze mid-page and a subtle amber horizon near contact.
 */
export function AtmosphereDescent() {
  const progress = useScrollProgress()
  const reduced = useReducedMotion()

  const p = reduced ? 0.35 : progress

  const upperAtmo = band(p, 0.08, 0.45)
  const lowerAtmo = band(p, 0.38, 0.72)
  const touchdown = band(p, 0.68, 0.95)

  const baseR = Math.round(lerp(6, 14, lowerAtmo + touchdown * 0.4))
  const baseG = Math.round(lerp(6, 11, lowerAtmo))
  const baseB = Math.round(lerp(10, 8, touchdown * 0.5))

  const indigoStrength = lerp(0.14, 0.28, upperAtmo) + lerp(0, 0.12, lowerAtmo)
  const violetStrength = lerp(0.06, 0.18, lowerAtmo)
  const amberStrength = lerp(0, 0.22, touchdown)
  const horizonOpacity = lerp(0, 0.55, touchdown)

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--vignette-opacity',
      String(lerp(0.22, 0.38, touchdown)),
    )
    return () => {
      document.documentElement.style.setProperty('--vignette-opacity', '0.25')
    }
  }, [touchdown])

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

  return (
    <div
      className="fixed inset-0 pointer-events-none transition-[opacity] duration-300"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {/* Base tint — shifts from cold void to warm lower atmosphere */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(
            180deg,
            rgb(${baseR}, ${baseG}, ${baseB}) 0%,
            rgb(${Math.round(lerp(8, 16, lowerAtmo))}, ${Math.round(lerp(8, 12, lowerAtmo))}, ${Math.round(lerp(18, 14, lowerAtmo))}) 45%,
            rgb(${Math.round(lerp(10, 18, touchdown))}, ${Math.round(lerp(10, 14, touchdown))}, ${Math.round(lerp(16, 10, touchdown))}) 100%
          )`,
          opacity: lerp(0.35, 0.72, clamp01(upperAtmo + lowerAtmo * 0.5 + touchdown * 0.3)),
        }}
      />

      {/* Upper-atmosphere indigo glow (replaces static page-glow top) */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(
            ellipse 85% 55% at 22% ${lerp(-8, 4, upperAtmo)}%,
            rgba(99, 102, 241, ${indigoStrength}),
            transparent 58%
          )`,
        }}
      />

      {/* Mid-page violet haze */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(
            ellipse 70% 50% at 78% ${lerp(18, 42, lowerAtmo)}%,
            rgba(129, 140, 248, ${violetStrength}),
            transparent 52%
          )`,
        }}
      />

      {/* Lower-atmosphere warmth from below */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(
            ellipse 90% 50% at 50% ${lerp(92, 78, touchdown)}%,
            rgba(201, 169, 98, ${amberStrength}),
            transparent 55%
          )`,
        }}
      />

      {/* Horizon band near touchdown / contact */}
      <div
        className="absolute inset-x-0 bottom-0 h-[38vh]"
        style={{
          opacity: horizonOpacity,
          background: `linear-gradient(
            to top,
            rgba(180, 140, 70, ${lerp(0.06, 0.14, touchdown)}) 0%,
            rgba(129, 140, 248, ${lerp(0.04, 0.08, touchdown)}) 35%,
            transparent 100%
          )`,
        }}
      />
    </div>
  )
}
