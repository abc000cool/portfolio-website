import { useEffect, useState, type RefObject } from 'react'

const DEFAULT_OPTIONS: IntersectionObserverInit = {
  threshold: 0,
  rootMargin: '0px 0px 35% 0px',
}

function optionsKey(options?: IntersectionObserverInit): string {
  if (!options) return ''
  return JSON.stringify({
    root: options.root ?? null,
    rootMargin: options.rootMargin ?? '',
    threshold: options.threshold ?? 0,
  })
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
  const optsKey = optionsKey(options)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const parsed = optsKey ? (JSON.parse(optsKey) as IntersectionObserverInit) : {}
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { ...DEFAULT_OPTIONS, ...parsed },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, optsKey])

  return inView
}

/** Prefetch research 3D chunks before the user scrolls into viewers. */
export function prefetchResearchViewers(): void {
  void import('../components/three/SpaceDebrisOrbit')
  void import('../components/three/MorphingAirfoil')
  void import('../components/three/FlowStateTraffic')
}
