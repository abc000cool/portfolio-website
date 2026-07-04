import { type RefObject } from 'react'
import { useWaypointReached } from '../context/MissionContext'
import { useInView } from './useInView'

const REVEAL_OBSERVER: IntersectionObserverInit = {
  threshold: 0,
  rootMargin: '0px 0px 35% 0px',
}

/**
 * Mission waypoint reveal with IntersectionObserver fallback.
 * Prevents headings/content staying invisible when flight-path progress
 * desyncs on mobile Safari or after layout shifts.
 */
export function useSectionReveal(
  waypointId: string,
  ref: RefObject<Element | null>,
): boolean {
  const reached = useWaypointReached(waypointId)
  const inView = useInView(ref, REVEAL_OBSERVER)
  return reached || inView
}
