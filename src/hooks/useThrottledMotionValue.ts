import { useEffect, useRef, useState } from 'react'
import { useMotionValueEvent, type MotionValue } from 'motion/react'

/** Throttle MotionValue → React state for telemetry UI (avoids scroll jank). */
export function useThrottledMotionValue(source: MotionValue<number>, intervalMs = 120): number {
  const [value, setValue] = useState(() => source.get())
  const lastUpdate = useRef(0)

  useEffect(() => {
    setValue(source.get())
  }, [source])

  useMotionValueEvent(source, 'change', (v) => {
    const now = performance.now()
    if (now - lastUpdate.current >= intervalMs) {
      lastUpdate.current = now
      setValue(v)
    }
  })

  return value
}
