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

/**
 * Everything the scroll -> path-progress map needs, measured once.
 *
 * The map used to read the DOM on every scroll tick (two getElementById, two
 * getBoundingClientRect and an offsetHeight), which forces layout inside the
 * scroll handler. All of those values only change on resize or a ScrollTrigger
 * refresh, so they are captured here and the per-tick map is pure arithmetic.
 */
export interface ScrollPathMapping {
  /** Document-space Y of the path container. */
  containerTop: number
  /** Viewport offset of the probe line (window.innerHeight * PROBE_RATIO). */
  probeOffset: number
  /** Container-relative Y of each waypoint. */
  waypointYs: number[]
  arcLengths: number[]
  totalPathLength: number
  /** Container-relative top of the intro section, or null when the long-intro map does not apply. */
  introTop: number | null
  introHeight: number
  introArcStart: number
  introArcEnd: number
  heroY: number
}

export function buildScrollPathMapping(
  container: HTMLElement,
  waypoints: Waypoint[],
  arcLengths: number[],
  totalPathLength: number,
): ScrollPathMapping | null {
  if (waypoints.length < 2 || totalPathLength <= 0 || arcLengths.length < 2) return null

  const containerTop = container.getBoundingClientRect().top + window.scrollY
  const introEl = document.getElementById('intro')
  const heroIdx = waypoints.findIndex((w) => w.id === 'hero')
  const longIntro = introEl !== null && heroIdx === 1

  return {
    containerTop,
    probeOffset: window.innerHeight * PROBE_RATIO,
    waypointYs: waypoints.map((w) => w.y),
    arcLengths,
    totalPathLength,
    introTop: longIntro && introEl
      ? introEl.getBoundingClientRect().top + window.scrollY - containerTop
      : null,
    introHeight: longIntro && introEl ? introEl.offsetHeight : 0,
    introArcStart: arcLengths[0] ?? 0,
    introArcEnd: arcLengths[1] ?? 0,
    heroY: heroIdx >= 0 ? waypoints[heroIdx].y : 0,
  }
}

/**
 * Maps scroll position to 0–1 progress along the SVG path (by arc length).
 * Pure arithmetic over a cached mapping - safe to call every frame.
 */
export function mapScrollToPathProgress(scrollY: number, m: ScrollPathMapping): number {
  const ys = m.waypointYs
  if (ys.length < 2 || m.totalPathLength <= 0) return 0

  const py = scrollY - m.containerTop + m.probeOffset
  const firstY = ys[0]
  const lastY = ys[ys.length - 1]

  if (py <= firstY) return 0
  if (py >= lastY) return 1

  // Long intro scroll: map scroll distance through intro to the intro→hero arc segment
  if (m.introTop !== null && m.introHeight > 0 && py <= m.heroY) {
    const t = Math.min(1, Math.max(0, scrollY - m.introTop) / m.introHeight)
    return (m.introArcStart + t * (m.introArcEnd - m.introArcStart)) / m.totalPathLength
  }

  for (let i = 0; i < ys.length - 1; i++) {
    if (py >= ys[i] && py <= ys[i + 1]) {
      const span = ys[i + 1] - ys[i]
      // A zero-height span would produce NaN and blank the rocket transform.
      const t = span > 0 ? (py - ys[i]) / span : 0
      const start = m.arcLengths[i]
      const end = m.arcLengths[i + 1]
      return (start + t * (end - start)) / m.totalPathLength
    }
  }

  return 0
}

/** Convenience wrapper that measures and maps in one call. */
export function scrollProgressToPathProgress(
  scrollY: number,
  waypoints: Waypoint[],
  arcLengths: number[],
  totalPathLength: number,
): number {
  const container = document.getElementById('main-content')
  if (!container) return 0
  const mapping = buildScrollPathMapping(container, waypoints, arcLengths, totalPathLength)
  return mapping ? mapScrollToPathProgress(scrollY, mapping) : 0
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
