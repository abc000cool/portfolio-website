import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { ScrollTrigger } from '../../lib/scrollTrigger'

const STORAGE_PREFIX = 'sp:'

/**
 * In-session mirror of sessionStorage. Scroll fires dozens of times a second;
 * serialising into sessionStorage on every one of those is exactly the kind of
 * main-thread tax this site does not need. We keep the live value in memory and
 * only persist when the entry is actually left behind (or the tab goes away).
 */
const positions = new Map<string, number>()

function persist(key: string): void {
  const y = positions.get(key)
  if (y === undefined) return
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, String(Math.round(y)))
  } catch {
    // Private mode / storage full — restoration is a nicety, never a failure.
  }
}

function recall(key: string): number | null {
  const live = positions.get(key)
  if (live !== undefined) return live
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key)
    if (raw === null) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

/**
 * Scroll management across route changes.
 *
 * Forward navigation (PUSH/REPLACE) still resets to the top — that was written
 * to fix landing part-way down a freshly mounted project/ISM page and it stays.
 * Back/forward (POP) restores where the entry was left, because drilling into a
 * project and backing out is how this site is actually read, and dumping the
 * reader at the top of a very long homepage every time is hostile.
 */
export function ScrollToTop() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const activeKey = useRef(location.key)

  // We restore ourselves; letting the browser also guess produces a double jump.
  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return
    const previous = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => {
      window.history.scrollRestoration = previous
    }
  }, [])

  // Track the live position for whichever history entry is on screen. Reading
  // window.scrollY inside the route-change effect is too late: by then the new
  // tree has laid out and the browser may already have clamped scroll to the
  // new document height.
  useEffect(() => {
    let raf = 0
    let pending = 0

    const flush = () => {
      raf = 0
      positions.set(activeKey.current, pending)
    }
    const onScroll = () => {
      pending = window.scrollY
      if (!raf) raf = requestAnimationFrame(flush)
    }
    const onHide = () => {
      flush()
      persist(activeKey.current)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pagehide', onHide)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    const key = location.key
    const leaving = activeKey.current

    if (leaving !== key) {
      persist(leaving)
      activeKey.current = key
    }

    const saved = navigationType === 'POP' ? recall(key) : null

    if (saved === null || saved <= 0) {
      window.scrollTo(0, 0)
      positions.set(key, 0)
      return
    }

    let cancelled = false
    const stop = () => {
      cancelled = true
    }

    // The reader taking over always wins over a pending re-assert.
    const inputEvents = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
    inputEvents.forEach((type) =>
      window.addEventListener(type, stop, { passive: true, once: true }),
    )

    const apply = () => {
      if (cancelled) return
      window.scrollTo(0, saved)
      ScrollTrigger.refresh()
    }

    // Frame one lets React commit the restored tree, frame two lets it lay out.
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(apply)
    })

    // The homepage refreshes ScrollTrigger at 600ms and 1800ms as lazy 3D
    // viewers and images resolve; each of those can grow the document and
    // strand a restore that was clamped to an earlier, shorter height.
    const reassert = (delay: number) =>
      window.setTimeout(() => {
        if (cancelled) return
        if (Math.abs(window.scrollY - saved) > 8) window.scrollTo(0, saved)
      }, delay)

    // A hash on the URL means HomePage's own hash handler is about to scroll;
    // don't fight it.
    const timers = location.hash ? [] : [reassert(700), reassert(1900)]

    return () => {
      cancelAnimationFrame(outer)
      if (inner) cancelAnimationFrame(inner)
      timers.forEach((t) => window.clearTimeout(t))
      inputEvents.forEach((type) => window.removeEventListener(type, stop))
    }
  }, [location.key, location.hash, navigationType])

  return null
}
