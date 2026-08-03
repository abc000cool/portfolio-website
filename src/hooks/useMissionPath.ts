import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { buildSmoothPath, measureWaypoints, type Waypoint } from '../lib/missionPath'

interface MissionPathState {
  pathD: string
  waypoints: Waypoint[]
  height: number
  width: number
  ready: boolean
}

const EMPTY: MissionPathState = {
  pathD: '',
  waypoints: [],
  height: 0,
  width: 0,
  ready: false,
}

/**
 * Height changes smaller than this do not move the path enough to see.
 *
 * Rebuilding is expensive: it measures every waypoint, rebuilds the path
 * geometry, and re-renders FlightPath, which regenerates a large arc-length
 * lookup table. Against a document tens of thousands of pixels tall, a hundred
 * pixels is a fraction of a percent of the path length.
 */
const HEIGHT_EPSILON = 140

export function useMissionPath(containerRef: RefObject<HTMLElement | null>): MissionPathState {
  const [state, setState] = useState<MissionPathState>(EMPTY)
  const lastRef = useRef({ width: 0, height: 0 })

  const measure = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const waypoints = measureWaypoints(container)
    const width = container.clientWidth
    const height = container.scrollHeight
    lastRef.current = { width, height }
    const pathD = buildSmoothPath(waypoints, width)

    setState({
      pathD,
      waypoints,
      height,
      width,
      ready: waypoints.length > 0,
    })
  }, [containerRef])

  useEffect(() => {
    measure()

    const container = containerRef.current
    if (!container) return

    let raf = 0
    let trailing = 0

    /**
     * The observer used to call measure() synchronously on every size change.
     * Hovering a project card animates its height for a few hundred
     * milliseconds, so one hover fired dozens of full path rebuilds and stalled
     * the main thread for a quarter of a second at a time.
     *
     * Now: ignore changes too small to see, and coalesce the rest into a single
     * rebuild once the size has settled.
     */
    const schedule = () => {
      const el = containerRef.current
      if (!el) return
      const last = lastRef.current
      if (
        el.clientWidth === last.width &&
        Math.abs(el.scrollHeight - last.height) < HEIGHT_EPSILON
      ) {
        return
      }

      window.clearTimeout(trailing)
      trailing = window.setTimeout(() => {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(measure)
      }, 120)
    }

    const observer = new ResizeObserver(schedule)
    observer.observe(container)
    window.addEventListener('resize', schedule)
    window.addEventListener('load', measure)
    // Late passes: fonts, lazily mounted media and the intro all settle after
    // first paint, and each changes the document height.
    const delayed = setTimeout(measure, 400)
    const delayed2 = setTimeout(measure, 1500)
    const delayed3 = setTimeout(measure, 3000)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('load', measure)
      cancelAnimationFrame(raf)
      window.clearTimeout(trailing)
      clearTimeout(delayed)
      clearTimeout(delayed2)
      clearTimeout(delayed3)
    }
  }, [measure, containerRef])

  return state
}
