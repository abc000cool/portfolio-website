import Lenis from 'lenis'
import { gsap, ScrollTrigger } from './scrollTrigger'

let lenisInstance: Lenis | null = null
let tickerFn: ((time: number) => void) | null = null

/**
 * Past this many viewport heights, animating real scroll position is pure cost:
 * every scroll-driven system between here and there fires on the way through and
 * the arrival is disorienting. Beyond it we jump instead of travelling.
 */
const LONG_JUMP_VIEWPORTS = 3

/** Short in-section moves keep an ease; these are the bounds for it. */
const MIN_TRAVEL_DURATION = 0.35
const MAX_TRAVEL_DURATION = 0.75

/** Ease-out cubic - decelerates into the target without a long tail. */
const travelEasing = (t: number) => 1 - Math.pow(1 - t, 3)

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function viewportHeight(): number {
  return window.innerHeight || 800
}

function travelDuration(distance: number): number {
  const ratio = distance / viewportHeight()
  return Math.min(MAX_TRAVEL_DURATION, MIN_TRAVEL_DURATION + ratio * 0.14)
}

export function initLenis(reducedMotion: boolean, touchDevice = false): Lenis | null {
  if (reducedMotion || touchDevice) return null
  if (lenisInstance) return lenisInstance

  const lenis = new Lenis({
    // `lerp` instead of `duration`/`easing`: Lenis only uses one or the other
    // (Animate.advance prefers duration+easing when both are set). A fixed
    // duration re-times the whole settle on every wheel tick, which is what
    // made the page feel like it was lagging a frame behind the input. A lerp
    // of 0.1 is a frame-rate-damped catch-up - smooth, but it lands fast.
    lerp: 0.1,
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1.5,
  })

  // Lenis drives native scroll, so ScrollTrigger just needs update ticks -
  // no scrollerProxy (that pattern is for transform-based scrollers and
  // breaks every scrub/pin when misapplied).
  lenis.on('scroll', ScrollTrigger.update)

  tickerFn = (time: number) => lenis.raf(time * 1000)
  gsap.ticker.add(tickerFn)
  gsap.ticker.lagSmoothing(0)

  lenisInstance = lenis
  return lenis
}

export function destroyLenis(): void {
  if (tickerFn) {
    gsap.ticker.remove(tickerFn)
    tickerFn = null
  }
  lenisInstance?.destroy()
  lenisInstance = null
}

/**
 * Move to an absolute document Y. Distance decides the transfer function:
 * near targets ease, far targets cut. Reduced motion always cuts.
 */
function travelTo(y: number, maxDuration = MAX_TRAVEL_DURATION): void {
  if (typeof window === 'undefined') return

  const target = Math.max(0, y)
  const distance = Math.abs(target - window.scrollY)
  const cut = prefersReducedMotion() || distance > LONG_JUMP_VIEWPORTS * viewportHeight()

  if (lenisInstance) {
    if (cut) {
      lenisInstance.scrollTo(target, { immediate: true })
    } else {
      lenisInstance.scrollTo(target, {
        duration: Math.min(maxDuration, travelDuration(distance)),
        easing: travelEasing,
      })
    }
    return
  }

  window.scrollTo({ top: target, behavior: cut ? 'auto' : 'smooth' })
}

export function scrollToSection(id: string): void {
  const el = document.getElementById(id)
  if (!el) return
  travelTo(el.getBoundingClientRect().top + window.scrollY)
}

/** Scroll to an absolute document Y (used by pinned-section tab jumps). */
export function scrollToY(y: number, duration = MAX_TRAVEL_DURATION): void {
  travelTo(y, duration)
}
