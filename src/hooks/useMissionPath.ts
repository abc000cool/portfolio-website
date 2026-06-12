import { useCallback, useEffect, useState, type RefObject } from 'react'
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

export function useMissionPath(containerRef: RefObject<HTMLElement | null>): MissionPathState {
  const [state, setState] = useState<MissionPathState>(EMPTY)

  const measure = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const waypoints = measureWaypoints(container)
    const width = container.clientWidth
    const pathD = buildSmoothPath(waypoints, width)

    setState({
      pathD,
      waypoints,
      height: container.scrollHeight,
      width,
      ready: waypoints.length > 0,
    })
  }, [containerRef])

  useEffect(() => {
    measure()

    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => measure())
    observer.observe(container)
    window.addEventListener('resize', measure)
    window.addEventListener('load', measure)
    const delayed = setTimeout(measure, 400)
    const delayed2 = setTimeout(measure, 1500)
    const delayed3 = setTimeout(measure, 3000)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('load', measure)
      clearTimeout(delayed)
      clearTimeout(delayed2)
      clearTimeout(delayed3)
    }
  }, [measure, containerRef])

  return state
}
