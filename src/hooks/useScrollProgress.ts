import { useEffect, useState } from 'react'

/** Normalized document scroll progress (0–1), throttled via rAF. */
export function useScrollProgress(enabled = true): number {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!enabled) return

    let raf = 0
    let latest = 0
    let scheduled = false

    const read = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      latest = docHeight > 0 ? window.scrollY / docHeight : 0
    }

    const flush = () => {
      scheduled = false
      setProgress((prev) => (Math.abs(prev - latest) > 0.002 ? latest : prev))
    }

    const onScroll = () => {
      read()
      if (!scheduled) {
        scheduled = true
        raf = requestAnimationFrame(flush)
      }
    }

    read()
    flush()

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [enabled])

  return progress
}
