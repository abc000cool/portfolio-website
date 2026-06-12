import { useEffect, useRef, useState, type RefObject } from 'react'

export function useSectionActive(threshold = 0.35): [RefObject<HTMLElement | null>, boolean] {
  const ref = useRef<HTMLElement>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { threshold },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return [ref, active]
}
