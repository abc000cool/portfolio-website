import { useEffect, useState, type RefObject } from 'react'

export function useIntersectionPause(
  ref: RefObject<Element | null>,
  options?: IntersectionObserverInit,
): boolean {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.05, ...options },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, options])

  return isVisible
}
