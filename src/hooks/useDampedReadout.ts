import { useEffect, useRef, useState } from 'react'
import { MAX_DELTA, approach } from '../lib/viewerMath'

const READOUT_EPSILON = 2e-4
const READOUT_EMIT_MS = 40

/**
 * Eases a displayed number toward its target on a self-terminating rAF loop.
 *
 * The 3D scene keeps consuming scroll at full rate; only the HUD read-out is
 * damped, so counters settle into place instead of stepping with every
 * throttled scroll sample. Same contract as the private copy inside
 * TransitionAtlas - extracted so the newer viewers can share it.
 */
export function useDampedReadout(target: number, rate: number): number {
  const [shown, setShown] = useState(target)
  const valueRef = useRef(target)
  const targetRef = useRef(target)
  const frameRef = useRef(0)

  useEffect(() => {
    targetRef.current = target
    // A loop that is already running picks the new target up on its next step,
    // and there is nothing to animate once the two agree.
    if (frameRef.current !== 0) return
    if (Math.abs(target - valueRef.current) < READOUT_EPSILON) return

    let last = performance.now()
    let emitted = 0
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, MAX_DELTA)
      last = now
      valueRef.current = approach(valueRef.current, targetRef.current, rate, dt)
      if (Math.abs(targetRef.current - valueRef.current) < READOUT_EPSILON) {
        // Settled: land exactly on the target and stop asking for frames.
        valueRef.current = targetRef.current
        frameRef.current = 0
        setShown(valueRef.current)
        return
      }
      if (now - emitted >= READOUT_EMIT_MS) {
        emitted = now
        setShown(valueRef.current)
      }
      frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)
  }, [target, rate])

  useEffect(() => () => cancelAnimationFrame(frameRef.current), [])

  return shown
}
