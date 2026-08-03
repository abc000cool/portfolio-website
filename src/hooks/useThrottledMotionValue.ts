import { useRef, useState } from 'react'
import { useMotionValueEvent, type MotionValue } from 'motion/react'

/** Throttle MotionValue → React state for telemetry UI (avoids scroll jank). */
export function useThrottledMotionValue(source: MotionValue<number>, intervalMs = 120): number {
  const [value, setValue] = useState(() => source.get())
  const [lastSource, setLastSource] = useState(source)
  const lastUpdate = useRef(0)

  // Resync when the caller hands us a different MotionValue. This used to be an
  // effect, which meant one render against the previous source's value before
  // the correction landed; adjusting during render skips that stale frame.
  if (lastSource !== source) {
    setLastSource(source)
    setValue(source.get())
  }

  useMotionValueEvent(source, 'change', (v) => {
    const now = performance.now()
    if (now - lastUpdate.current >= intervalMs) {
      lastUpdate.current = now
      setValue(v)
    }
  })

  return value
}
