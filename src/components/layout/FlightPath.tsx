import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import { ScrollTrigger } from '../../lib/scrollTrigger'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useLightExperience, useTouchDevice } from '../../hooks/useTouchDevice'
import { useMissionPath } from '../../hooks/useMissionPath'
import {
  buildPathMetrics,
  headingAt,
  pathProgressAt,
  pointAt,
  waypointPathProgress,
  type PathMetrics,
  type PathPoint,
} from '../../lib/missionPath'
import { labelChipWidth, railGeometry } from '../../lib/waypointLayout'
import { SECTION_LABELS, type SectionId } from '../../data/portfolio'
import { scrollToSection } from '../../lib/lenis'
import { RocketShip } from './RocketShip'
import { useMissionUpdater } from '../../context/missionState'

interface FlightPathProps {
  containerRef: RefObject<HTMLElement | null>
}

const ROCKET_LOOKAHEAD = 14
const REACH_EPSILON = 0.015

/**
 * Above the content wrapper (z-2 in ParallaxLayers) so waypoints are
 * hit-testable, below the fixed nav (z-50). The <svg> root stays
 * pointer-events:none — only each waypoint group opts back in.
 */
const FLIGHT_PATH_Z = 3

/** Reused across ticks so the scroll handler allocates nothing. */
const tip: PathPoint = { x: 0, y: 0 }

export function FlightPath({ containerRef }: FlightPathProps) {
  const pathRef = useRef<SVGPathElement>(null)
  const trailRef = useRef<SVGPathElement>(null)
  const rocketRef = useRef<SVGGElement>(null)
  const metricsRef = useRef<PathMetrics | null>(null)
  const lastMissionUpdate = useRef(0)

  const reduced = useReducedMotion()
  const light = useLightExperience()
  const touch = useTouchDevice()
  const { pathD, waypoints, height, width, ready } = useMissionPath(containerRef)
  const { update: updateMission, markAllReached } = useMissionUpdater()

  const [arcLengths, setArcLengths] = useState<number[]>([])
  const [totalLength, setTotalLength] = useState(0)
  const [reachedCount, setReachedCount] = useState(0)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)

  const rail = useMemo(() => railGeometry(width), [width])

  /**
   * Writes only. No DOM reads, no getPointAtLength, no allocation — the three
   * style writes below are the entire per-tick cost of the flight path.
   */
  const applyProgressVisuals = useCallback((p: number) => {
    const m = metricsRef.current
    const path = pathRef.current
    if (!m || !path || m.totalLength <= 0) return

    const length = m.totalLength
    const drawn = length * p

    path.style.strokeDasharray = `${drawn} ${length}`

    const trail = trailRef.current
    if (trail) trail.style.strokeDasharray = `${Math.max(0, drawn - 10)} ${length}`

    const rocket = rocketRef.current
    if (!rocket) return

    pointAt(m.samples, p, tip)
    const angle = headingAt(m.samples, p, ROCKET_LOOKAHEAD)
    rocket.setAttribute(
      'transform',
      `translate(${tip.x.toFixed(2)}, ${tip.y.toFixed(2)}) rotate(${(angle + 90).toFixed(1)})`,
    )
  }, [])

  // Measure once per layout: samples, arc lengths and every rect the scroll
  // handler would otherwise re-read on each tick.
  useEffect(() => {
    const path = pathRef.current
    const container = containerRef.current
    if (!path || !container || !ready || waypoints.length < 2) return

    const metrics = buildPathMetrics(container, path, waypoints)
    metricsRef.current = metrics
    setArcLengths(metrics.arcLengths)
    setTotalLength(metrics.totalLength)
  }, [pathD, ready, waypoints, containerRef])

  const checkpoints = useMemo(
    () =>
      waypoints.map((wp) => ({
        id: wp.id,
        at: waypointPathProgress(wp.index, arcLengths, totalLength),
      })),
    [waypoints, arcLengths, totalLength],
  )

  useEffect(() => {
    if (reduced || !ready || !containerRef.current || checkpoints.length < 2) return
    if (totalLength <= 0) return

    const container = containerRef.current

    const update = () => {
      const m = metricsRef.current
      if (!m) return

      const p = pathProgressAt(window.scrollY, m)
      applyProgressVisuals(p)

      let count = 0
      for (let i = 0; i < checkpoints.length; i++) {
        if (p >= checkpoints[i].at - REACH_EPSILON) count = i + 1
      }
      setReachedCount((prev) => (prev === count ? prev : count))

      const now = performance.now()
      if (now - lastMissionUpdate.current > (light ? 100 : 50)) {
        lastMissionUpdate.current = now
        updateMission(p, checkpoints)
      }
    }

    const st = ScrollTrigger.create({
      trigger: container,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: update,
    })

    update()

    return () => st.kill()
  }, [
    reduced,
    ready,
    containerRef,
    checkpoints,
    totalLength,
    updateMission,
    light,
    applyProgressVisuals,
  ])

  useEffect(() => {
    if (reduced && ready && checkpoints.length > 0) markAllReached(checkpoints)
  }, [reduced, ready, checkpoints, markAllReached])

  // Reduced motion: the trajectory is a static map, drawn complete.
  useEffect(() => {
    if (!reduced || totalLength <= 0) return
    const dash = `${totalLength} ${totalLength}`
    if (pathRef.current) pathRef.current.style.strokeDasharray = dash
    if (trailRef.current) trailRef.current.style.strokeDasharray = dash
  }, [reduced, totalLength])

  if (!ready || height === 0) return null

  const reached = reduced ? waypoints.length : reachedCount
  const interactive = rail.interactive
  const highlightId = hoveredId ?? focusedId
  // No rocket without a scroll handler to fly it, and none in a gutter too
  // narrow to hold it without grazing the content column.
  const showRocket = !touch && !reduced && interactive

  const goTo = (id: string) => scrollToSection(id)
  const onWaypointKey = (e: KeyboardEvent<SVGGElement>, id: string) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    goTo(id)
  }

  return (
    <svg
      className="absolute top-0 left-0 w-full overflow-visible"
      style={{ height, zIndex: FLIGHT_PATH_Z, pointerEvents: 'none' }}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMin meet"
      role={interactive ? 'navigation' : undefined}
      aria-label={interactive ? 'Flight path' : undefined}
      aria-hidden={interactive ? undefined : true}
    >
      <defs>
        <linearGradient id="path-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#a5b4fc" />
        </linearGradient>
      </defs>

      {/* The route ahead — static, so the reader can see where the trip goes. */}
      <path
        d={pathD}
        fill="none"
        stroke="rgba(148,163,184,0.16)"
        strokeWidth="1"
        strokeLinecap="round"
        strokeDasharray="2 7"
      />

      {/*
        Bloom. This used to be a Gaussian blur filter over a document tens of
        thousands of pixels tall, re-invalidated by every strokeDasharray write.
        A wide, soft-coloured stroke under the line reads the same and costs a
        single extra path rasterization.
      */}
      <path
        ref={trailRef}
        d={pathD}
        fill="none"
        stroke="url(#path-gradient)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.22"
        style={{ strokeDasharray: '0 1', strokeDashoffset: 0 }}
      />

      <path
        ref={pathRef}
        d={pathD}
        fill="none"
        stroke="url(#path-gradient)"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ strokeDasharray: '0 1', strokeDashoffset: 0 }}
      />

      {showRocket && (
        <g ref={rocketRef} aria-hidden="true">
          <RocketShip />
        </g>
      )}

      {waypoints.map((wp, i) => {
        const label = SECTION_LABELS[wp.id as SectionId] ?? wp.id
        const isReached = i < reached
        const isCurrent = i === reached - 1
        const isHot = highlightId === wp.id
        const isFocused = focusedId === wp.id
        const showLabel = rail.labelsFit || isHot
        const chipW = labelChipWidth(label)

        const marks = (
          <>
            {interactive && (
              <>
                <circle
                  cx={wp.x}
                  cy={wp.y}
                  r={rail.hitRadius}
                  fill="transparent"
                  style={{ pointerEvents: 'all' }}
                />
                {/* The label is part of the target, not decoration beside it. */}
                {rail.labelsFit && (
                  <rect
                    x={rail.labelX}
                    y={wp.y - 13}
                    width={chipW}
                    height="26"
                    fill="transparent"
                    style={{ pointerEvents: 'all' }}
                  />
                )}
              </>
            )}

            <circle
              cx={wp.x}
              cy={wp.y}
              r={isReached || isHot ? 8.5 : 5.5}
              fill={isReached ? 'rgba(129,140,248,0.16)' : 'rgba(8,8,14,0.6)'}
              stroke={isHot ? '#e0e7ff' : isReached ? '#818cf8' : 'rgba(148,163,184,0.4)'}
              strokeWidth={isCurrent || isHot ? 2 : 1.25}
              style={{
                transition: light ? 'none' : 'r 0.3s ease, stroke 0.3s ease, fill 0.3s ease',
              }}
            />

            {(isReached || isHot) && (
              <circle cx={wp.x} cy={wp.y} r="2.6" fill={isHot ? '#ffffff' : '#c7d2fe'} />
            )}

            {isFocused && (
              <>
                <circle
                  cx={wp.x}
                  cy={wp.y}
                  r="15"
                  fill="none"
                  stroke="#06060a"
                  strokeWidth="5"
                />
                <circle
                  cx={wp.x}
                  cy={wp.y}
                  r="15"
                  fill="none"
                  stroke="#a5b4fc"
                  strokeWidth="2"
                />
              </>
            )}

            {showLabel && (
              <g style={{ pointerEvents: 'none' }}>
                <rect
                  x={rail.labelX}
                  y={wp.y - 11}
                  width={chipW}
                  height="22"
                  rx="11"
                  fill="rgba(8,8,14,0.86)"
                  stroke={
                    isHot || isCurrent ? 'rgba(129,140,248,0.5)' : 'rgba(255,255,255,0.08)'
                  }
                  strokeWidth="1"
                />
                <text
                  x={rail.labelX + rail.labelPad}
                  y={wp.y + 4}
                  fill={isHot ? '#e2e8f0' : isReached ? '#a5b4fc' : '#8b98ab'}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.04em',
                  }}
                >
                  {label.toUpperCase()}
                </text>
              </g>
            )}
          </>
        )

        if (!interactive) {
          return (
            <g key={wp.id} aria-hidden="true">
              {marks}
            </g>
          )
        }

        return (
          <g
            key={wp.id}
            role="button"
            tabIndex={0}
            aria-label={`Go to ${label}`}
            aria-current={isCurrent ? 'true' : undefined}
            onClick={() => goTo(wp.id)}
            onKeyDown={(e) => onWaypointKey(e, wp.id)}
            onFocus={() => setFocusedId(wp.id)}
            onBlur={() => setFocusedId(null)}
            onPointerEnter={() => setHoveredId(wp.id)}
            onPointerLeave={() => setHoveredId(null)}
            style={{ pointerEvents: 'auto', cursor: 'pointer', outline: 'none' }}
          >
            <title>{label}</title>
            {marks}
          </g>
        )
      })}
    </svg>
  )
}
