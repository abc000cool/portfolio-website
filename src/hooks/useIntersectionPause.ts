import { useEffect, useState, type RefObject } from 'react'

/**
 * Lead margin on all four sides.
 *
 * This drives `frameloop` on every research canvas. With no margin the canvas
 * only began drawing once 5% of it was already on screen, so it sat on
 * frameloop="demand" holding whatever frame it last drew and then snapped to
 * the current scroll position the instant it crossed the threshold. Starting a
 * quarter-viewport early means that catch-up frame happens off-screen.
 *
 * Symmetric on purpose: a bottom-only margin gives no lead when scrolling back
 * up, because the element then enters through the top edge.
 */
const DEFAULT_OPTIONS: IntersectionObserverInit = {
  threshold: 0,
  rootMargin: '25% 0px 25% 0px',
}

function optionsKey(options?: IntersectionObserverInit): string {
  if (!options) return ''
  return JSON.stringify({
    root: options.root ?? null,
    rootMargin: options.rootMargin ?? '',
    threshold: options.threshold ?? 0,
  })
}

export function useIntersectionPause(
  ref: RefObject<Element | null>,
  options?: IntersectionObserverInit,
): boolean {
  // Starts true so a canvas paints its first frame without waiting on the
  // observer callback.
  const [isVisible, setIsVisible] = useState(true)
  const optsKey = optionsKey(options)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Keyed by value rather than identity: callers pass object literals, which
    // would otherwise tear down and rebuild the observer on every render.
    const parsed = optsKey ? (JSON.parse(optsKey) as IntersectionObserverInit) : {}
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { ...DEFAULT_OPTIONS, ...parsed },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, optsKey])

  return isVisible
}
