import { SECTION_IDS } from '../data/portfolio'
import { SECTION_WAYPOINT_SIDES, waypointX } from './waypointLayout'

export interface Waypoint {
  id: string
  x: number
  y: number
  index: number
  side: 'left' | 'center' | 'right'
}

const PROBE_RATIO = 0.42

function waypointY(
  id: string,
  rect: DOMRect,
  containerTop: number,
): number {
  const sectionTop = rect.top + window.scrollY - containerTop

  if (id === 'intro') {
    return sectionTop + 100
  }

  if (id === 'hero') {
    return sectionTop + Math.min(rect.height * 0.35, window.innerHeight * 0.38)
  }

  return sectionTop + rect.height / 2
}

export function measureWaypoints(container: HTMLElement): Waypoint[] {
  const containerTop = container.getBoundingClientRect().top + window.scrollY
  const width = container.clientWidth
  const waypoints: Waypoint[] = []

  SECTION_IDS.forEach((id, index) => {
    const el = document.getElementById(id)
    if (!el) return

    const rect = el.getBoundingClientRect()
    const y = waypointY(id, rect, containerTop)
    const side = SECTION_WAYPOINT_SIDES[id]
    const x = waypointX(side, width)

    waypoints.push({ id, x, y, index, side })
  })

  return waypoints
}

export function buildSmoothPath(waypoints: Waypoint[], width: number): string {
  if (waypoints.length === 0) return ''
  if (waypoints.length === 1) return `M ${waypoints[0].x} ${waypoints[0].y}`

  const sweep = width * 0.26
  let d = `M ${waypoints[0].x} ${waypoints[0].y}`

  for (let i = 1; i < waypoints.length; i++) {
    const prev = waypoints[i - 1]
    const curr = waypoints[i]
    const dy = Math.max(64, curr.y - prev.y)

    const c1x = prev.x + (prev.side === 'left' ? sweep : prev.side === 'right' ? -sweep : 0)
    const c2x = curr.x + (curr.side === 'right' ? sweep : curr.side === 'left' ? -sweep : 0)
    const c1y = prev.y + dy * 0.5
    const c2y = curr.y - dy * 0.5

    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${curr.x} ${curr.y}`
  }

  return d
}

export function getPathLength(pathEl: SVGPathElement | null): number {
  if (!pathEl) return 0
  return pathEl.getTotalLength()
}

/**
 * Arc-length at each waypoint along the rendered SVG path (monotonic).
 */
export function computeWaypointArcLengths(
  pathEl: SVGPathElement,
  waypoints: Waypoint[],
): number[] {
  const total = pathEl.getTotalLength()
  if (waypoints.length === 0) return []
  if (waypoints.length === 1) return [0]

  const lengths: number[] = [0]
  let searchFrom = 0

  for (let wi = 1; wi < waypoints.length; wi++) {
    const wp = waypoints[wi]
    let bestLen = searchFrom
    let bestDist = Infinity
    const steps = 120

    for (let s = 0; s <= steps; s++) {
      const len = searchFrom + (s / steps) * (total - searchFrom)
      const pt = pathEl.getPointAtLength(len)
      const dist = Math.hypot(pt.x - wp.x, pt.y - wp.y)
      if (dist < bestDist) {
        bestDist = dist
        bestLen = len
      }
    }

    lengths.push(Math.max(bestLen, lengths[lengths.length - 1] ?? 0))
    searchFrom = lengths[lengths.length - 1]
  }

  return lengths
}

function probeY(scrollY: number, containerTop: number): number {
  return scrollY - containerTop + window.innerHeight * PROBE_RATIO
}

/**
 * Maps scroll position to 0–1 progress along the SVG path (by arc length).
 */
export function scrollProgressToPathProgress(
  scrollY: number,
  waypoints: Waypoint[],
  arcLengths: number[],
  totalPathLength: number,
): number {
  if (waypoints.length < 2 || totalPathLength <= 0 || arcLengths.length < 2) return 0

  const container = document.getElementById('main-content')
  if (!container) return 0

  const containerTop = container.getBoundingClientRect().top + window.scrollY
  const py = probeY(scrollY, containerTop)

  const firstY = waypoints[0].y
  const lastY = waypoints[waypoints.length - 1].y

  if (py <= firstY) return 0
  if (py >= lastY) return 1

  const introEl = document.getElementById('intro')
  const heroIdx = waypoints.findIndex((w) => w.id === 'hero')

  // Long intro scroll: map scroll distance through intro to the intro→hero arc segment
  if (introEl && heroIdx === 1) {
    const introHeight = introEl.offsetHeight
    const heroY = waypoints[heroIdx].y
    const introDocTop = introEl.getBoundingClientRect().top + scrollY
    const scrollThroughIntro = Math.max(0, scrollY - introDocTop + containerTop)

    if (introHeight > 0 && py <= heroY) {
      const t = Math.min(1, scrollThroughIntro / introHeight)
      const start = arcLengths[0]
      const end = arcLengths[1]
      return (start + t * (end - start)) / totalPathLength
    }
  }

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]
    const b = waypoints[i + 1]
    if (py >= a.y && py <= b.y) {
      const t = (py - a.y) / (b.y - a.y)
      const start = arcLengths[i]
      const end = arcLengths[i + 1]
      return (start + t * (end - start)) / totalPathLength
    }
  }

  return py >= lastY ? 1 : 0
}

/** Normalized arc-length progress for a waypoint checkpoint (for dot highlighting). */
export function waypointPathProgress(
  index: number,
  arcLengths: number[],
  totalPathLength: number,
): number {
  if (totalPathLength <= 0 || arcLengths.length === 0) return 0
  return (arcLengths[index] ?? 0) / totalPathLength
}
