import { useEffect, useRef } from 'react'
import type { MotionValue } from 'motion/react'

/**
 * Mirrors a MotionValue into a ref, including the current value on mount.
 * useMotionValueEvent alone does not fire for the initial value.
 */
export function useMotionProgressRef(
  progress: MotionValue<number> | undefined,
  fallback = 0,
): React.RefObject<number> {
  const ref = useRef(fallback)

  useEffect(() => {
    if (!progress) {
      ref.current = fallback
      return
    }

    ref.current = progress.get()
    const unsubscribe = progress.on('change', (v) => {
      ref.current = v
    })
    return unsubscribe
  }, [progress, fallback])

  return ref
}
