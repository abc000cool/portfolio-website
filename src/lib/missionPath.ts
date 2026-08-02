import { SECTION_IDS } from '../data/portfolio'
import { SECTION_WAYPOINT_SIDES, waypointX, type WaypointSide } from './waypointLayout'

export interface Waypoint {
  id: string
  x: number
  y: number
  index: number
  side: WaypointSide
}

const PROBE_RATIO = 0.42

/**
 * Samples in the arc-length lookup table. The path is a handful of cubics over
 * a document tens of thousands of pixels tall; 1500 uniform samples put the
 * interpolation error well under a pixel and let the scroll handler run without
 * a single `getPointAtLength` call (each of those is a synchronous geometry
 * solve inside the SVG engine).
 */
const PATH_SAMPLE_COUNT = 1500

function waypointY(id: string, rect: DOMRect, containerTop: number): number {
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

/**
 * Vertical-dominant S-curve through the waypoints. Control points sit directly
 * above/below their waypoint, so the curve is bounded by the rail band and can
 * never bow out into the content column.
 */
export function buildSmoothPath(waypoints: Waypoint[], _width: number): string {
  void _width
  if (waypoints.length === 0) return ''
  if (waypoints.length === 1) return `M ${waypoints[0].x} ${waypoints[0].y}`

  let d = `M ${waypoints[0].x} ${waypoints[0].y}`

  for (let i = 1; i < waypoints.length; i++) {
    const prev = waypoints[i - 1]
    const curr = waypoints[i]
    const dy = Math.max(64, curr.y - prev.y)

    const c1y = prev.y + dy * 0.45
    const c2y = curr.y - dy * 0.45

    d += ` C ${prev.x} ${c1y}, ${curr.x} ${c2y}, ${curr.x} ${curr.y}`
  }

  return d
}

export function getPathLength(pathEl: SVGPathElement | null): number {
  if (!pathEl) return 0
  return pathEl.getTotalLength()
}

/* ------------------------------------------------------------------ *
 * Arc-length lookup table
 * ------------------------------------------------------------------ */

export interface PathSamples {
  /** Interleaved x,y pairs, uniformly spaced by arc length. */
  points: Float32Array
  count: number
  total: number
}

export interface PathPoint {
  x: number
  y: number
}

/** Build the lookup table. One pass of `getPointAtLength`, then never again. */
export function samplePath(
  pathEl: SVGPathElement,
  count = PATH_SAMPLE_COUNT,
): PathSamples {
  const total = pathEl.getTotalLength()
  const n = Math.max(2, count)
  const points = new Float32Array(n * 2)

  if (total <= 0) return { points, count: n, total: 0 }

  for (let i = 0; i < n; i++) {
    const pt = pathEl.getPointAtLength((i / (n - 1)) * total)
    points[i * 2] = pt.x
    points[i * 2 + 1] = pt.y
  }

  return { points, count: n, total }
}

/** Interpolated point at normalized arc-length progress. Writes into `out`. */
export function pointAt(samples: PathSamples, t: number, out: PathPoint): PathPoint {
  const n = samples.count
  const clamped = t <= 0 ? 0 : t >= 1 ? 1 : t
  const idx = clamped * (n - 1)
  const i0 = Math.floor(idx)
  const i1 = i0 >= n - 1 ? n - 1 : i0 + 1
  const f = idx - i0

  const ax = samples.points[i0 * 2]
  const ay = samples.points[i0 * 2 + 1]

  out.x = ax + (samples.points[i1 * 2] - ax) * f
  out.y = ay + (samples.points[i1 * 2 + 1] - ay) * f
  return out
}

const headA: PathPoint = { x: 0, y: 0 }
const headB: PathPoint = { x: 0, y: 0 }

/** Tangent heading in degrees at normalized progress, looking `lookahead` px ahead. */
export function headingAt(samples: PathSamples, t: number, lookahead: number): number {
  if (samples.total <= 0) return 0

  const dt = Math.min(0.5, lookahead / samples.total)
  const a = Math.max(0, Math.min(1 - dt, t))
  const b = Math.min(1, a + dt)

  pointAt(samples, a, headA)
  pointAt(samples, b, headB)

  return (Math.atan2(headB.y - headA.y, headB.x - headA.x) * 180) / Math.PI
}

/**
 * Arc-length at each waypoint (monotonic), resolved against the lookup table
 * rather than re-solving the path geometry per waypoint.
 */
export function computeWaypointArcLengths(
  samples: PathSamples,
  waypoints: Waypoint[],
): number[] {
  if (waypoints.length === 0) return []
  if (waypoints.length === 1) return [0]

  const n = samples.count
  const lengths: number[] = [0]
  let searchFrom = 0

  for (let wi = 1; wi < waypoints.length; wi++) {
    const wp = waypoints[wi]
    let bestIdx = searchFrom
    let bestDist = Infinity

    for (let i = searchFrom; i < n; i++) {
      const dx = samples.points[i * 2] - wp.x
      const dy = samples.points[i * 2 + 1] - wp.y
      const dist = dx * dx + dy * dy
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = i
      }
    }

    lengths.push((bestIdx / (n - 1)) * samples.total)
    searchFrom = bestIdx
  }

  return lengths
}

/* ------------------------------------------------------------------ *
 * Cached measurements
 * ------------------------------------------------------------------ */

/**
 * Everything the scroll handler needs, measured once per layout. The handler
 * used to call `getElementById` twice and read three rects per tick, in between
 * writing stroke dash values — a forced reflow on every single scroll event.
 */
export interface PathMetrics {
  waypoints: Waypoint[]
  arcLengths: number[]
  samples: PathSamples
  totalLength: number
  containerTop: number
  introTop: number
  introHeight: number
  viewportHeight: number
  heroIndex: number
}

export function buildPathMetrics(
  container: HTMLElement,
  pathEl: SVGPathElement,
  waypoints: Waypoint[],
): PathMetrics {
  const samples = samplePath(pathEl)
  const arcLengths = computeWaypointArcLengths(samples, waypoints)
  const scrollY = window.scrollY
  const intro = document.getElementById('intro')

  return {
    waypoints,
    arcLengths,
    samples,
    totalLength: samples.total,
    containerTop: container.getBoundingClientRect().top + scrollY,
    introTop: intro ? intro.getBoundingClientRect().top + scrollY : 0,
    introHeight: intro ? intro.offsetHeight : 0,
    viewportHeight: window.innerHeight,
    heroIndex: waypoints.findIndex((w) => w.id === 'hero'),
  }
}

/** Maps scroll position to 0–1 progress along the path, by arc length. */
export function pathProgressAt(scrollY: number, m: PathMetrics): number {
  const { waypoints, arcLengths, totalLength } = m
  if (waypoints.length < 2 || totalLength <= 0 || arcLengths.length < 2) return 0

  const py = scrollY - m.containerTop + m.viewportHeight * PROBE_RATIO
  const firstY = waypoints[0].y
  const lastY = waypoints[waypoints.length - 1].y

  if (py <= firstY) return 0
  if (py >= lastY) return 1

  // Long intro scroll: map scroll distance through the intro to the intro→hero arc.
  if (m.introHeight > 0 && m.heroIndex === 1 && py <= waypoints[1].y) {
    const through = Math.max(0, scrollY - m.introTop + m.containerTop)
    const t = Math.min(1, through / m.introHeight)
    return (arcLengths[0] + t * (arcLengths[1] - arcLengths[0])) / totalLength
  }

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]
    const b = waypoints[i + 1]
    if (py >= a.y && py <= b.y) {
      const t = b.y === a.y ? 0 : (py - a.y) / (b.y - a.y)
      return (arcLengths[i] + t * (arcLengths[i + 1] - arcLengths[i])) / totalLength
    }
  }

  return 1
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
