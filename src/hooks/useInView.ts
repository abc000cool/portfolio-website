import { useEffect, useRef, useState, type RefObject } from 'react'

const DEFAULT_OPTIONS: IntersectionObserverInit = {
  threshold: 0.06,
  rootMargin: '0px 0px -8% 0px',
}

/**
 * True when the element intersects the viewport.
 * Starts false (unlike useIntersectionPause) so reveal triggers on first entry.
 */
export function useInView(
  ref: RefObject<Element | null>,
  options?: IntersectionObserverInit,
): boolean {
  const [inView, setInView] = useState(false)
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { ...DEFAULT_OPTIONS, ...optionsRef.current },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return inView
}

/** Prefetch research 3D chunks before the user scrolls into viewers. */
export function prefetchResearchViewers(): void {
  void import('../components/three/SpaceDebrisOrbit')
  void import('../components/three/MorphingAirfoil')
  void import('../components/three/FlowStateTraffic')
}
