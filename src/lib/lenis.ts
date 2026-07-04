import Lenis from 'lenis'
import { gsap, ScrollTrigger } from './scrollTrigger'

let lenisInstance: Lenis | null = null
let tickerFn: ((time: number) => void) | null = null

export function initLenis(reducedMotion: boolean, touchDevice = false): Lenis | null {
  if (reducedMotion || touchDevice) return null
  if (lenisInstance) return lenisInstance

  const lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    touchMultiplier: 1.5,
  })

  // Lenis drives native scroll, so ScrollTrigger just needs update ticks —
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

export function scrollToSection(id: string): void {
  const el = document.getElementById(id)
  if (!el) return
  if (lenisInstance) {
    lenisInstance.scrollTo(el, { offset: 0, duration: 1.4 })
  } else {
    el.scrollIntoView({ behavior: 'smooth' })
  }
}

/** Scroll to an absolute document Y (used by pinned-section tab jumps). */
export function scrollToY(y: number, duration = 1.2): void {
  if (lenisInstance) {
    lenisInstance.scrollTo(y, { duration })
  } else {
    window.scrollTo({ top: y, behavior: 'smooth' })
  }
}
