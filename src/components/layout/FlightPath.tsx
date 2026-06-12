import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { ScrollTrigger } from '../../lib/scrollTrigger'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useMissionPath } from '../../hooks/useMissionPath'
import {
  computeWaypointArcLengths,
  getPathLength,
  scrollProgressToPathProgress,
  waypointPathProgress,
} from '../../lib/missionPath'
import { RocketShip } from './RocketShip'
import { useMissionUpdater } from '../../context/MissionContext'

interface FlightPathProps {
  containerRef: RefObject<HTMLElement | null>
}

export function FlightPath({ containerRef }: FlightPathProps) {
  const pathRef = useRef<SVGPathElement>(null)
  const rocketRef = useRef<SVGGElement>(null)
  const trailRef = useRef<SVGPathElement>(null)
  const reduced = useReducedMotion()
  const { pathD, waypoints, height, width, ready } = useMissionPath(containerRef)
  const [progress, setProgress] = useState(0)
  const [arcLengths, setArcLengths] = useState<number[]>([])
  const [totalLength, setTotalLength] = useState(0)
  const { update: updateMission, markAllReached } = useMissionUpdater()

  useEffect(() => {
    const path = pathRef.current
    if (!path || !ready || waypoints.length < 2) return

    const length = getPathLength(path)
    const lengths = computeWaypointArcLengths(path, waypoints)
    setTotalLength(length)
    setArcLengths(lengths)
  }, [pathD, ready, waypoints])

  const checkpoints = useMemo(
    () =>
      waypoints.map((wp) => ({
        id: wp.id,
        at: waypointPathProgress(wp.index, arcLengths, totalLength),
      })),
    [waypoints, arcLengths, totalLength],
  )

  useEffect(() => {
    if (reduced || !ready || !containerRef.current || arcLengths.length < 2 || totalLength <= 0) {
      return
    }

    const container = containerRef.current

    const update = () => {
      const p = scrollProgressToPathProgress(window.scrollY, waypoints, arcLengths, totalLength)
      setProgress(p)
      updateMission(p, checkpoints)
    }

    const st = ScrollTrigger.create({
      trigger: container,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: update,
    })

    update()

    return () => st.kill()
  }, [reduced, ready, containerRef, waypoints, arcLengths, totalLength, checkpoints, updateMission])

  // Reduced motion: no scroll-driven progress, so reveal everything immediately
  useEffect(() => {
    if (reduced && ready && checkpoints.length > 0) markAllReached(checkpoints)
  }, [reduced, ready, checkpoints, markAllReached])

  useEffect(() => {
    const path = pathRef.current
    const trail = trailRef.current
    const rocket = rocketRef.current
    if (!path || !rocket) return

    const length = getPathLength(path)
    if (length === 0) return

    const drawn = length * progress
    path.style.strokeDasharray = `${drawn} ${length}`
    path.style.strokeDashoffset = '0'

    if (trail) {
      const trailLen = Math.max(0, drawn - 8)
      trail.style.strokeDasharray = `${trailLen} ${length}`
      trail.style.strokeDashoffset = '0'
    }

    const tip = Math.max(0, Math.min(length, drawn))
    const point = path.getPointAtLength(tip)
    const lookAhead = path.getPointAtLength(Math.min(length, tip + 2))
    const angle =
      (Math.atan2(lookAhead.y - point.y, lookAhead.x - point.x) * 180) / Math.PI

    rocket.setAttribute(
      'transform',
      `translate(${point.x}, ${point.y}) rotate(${angle + 90})`,
    )
  }, [progress, pathD, ready])

  useEffect(() => {
    if (!reduced || !pathRef.current) return
    const length = getPathLength(pathRef.current)
    pathRef.current.style.strokeDasharray = `${length} ${length}`
    pathRef.current.style.strokeDashoffset = '0'
  }, [reduced, pathD])

  if (!ready || height === 0) return null

  return (
    <svg
      className="absolute top-0 left-0 w-full pointer-events-none overflow-visible"
      style={{ height, zIndex: 1 }}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMin meet"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="path-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#a5b4fc" />
        </linearGradient>
        <filter id="path-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {waypoints.map((wp, i) => {
        const wpProgress = checkpoints[i]?.at ?? 0
        const reached = progress >= wpProgress - 0.015
        return (
          <g key={wp.id}>
            <circle
              cx={wp.x}
              cy={wp.y}
              r={reached ? 10 : 6}
              fill={reached ? 'rgba(129, 140, 248, 0.12)' : 'transparent'}
              stroke={reached ? '#818cf8' : 'rgba(148, 163, 184, 0.2)'}
              strokeWidth={reached ? 1.5 : 1}
              style={{ transition: 'all 0.4s ease' }}
            />
            {reached && (
              <>
                <circle cx={wp.x} cy={wp.y} r="3" fill="#c7d2fe" opacity="0.95" />
                <circle
                  cx={wp.x}
                  cy={wp.y}
                  r="14"
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="0.5"
                  opacity="0.35"
                />
              </>
            )}
          </g>
        )
      })}

      <path
        ref={trailRef}
        d={pathD}
        fill="none"
        stroke="url(#path-gradient)"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.12"
      />

      <path
        ref={pathRef}
        d={pathD}
        fill="none"
        stroke="url(#path-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        filter="url(#path-glow)"
        style={{ strokeDasharray: '0 1', strokeDashoffset: 0 }}
      />

      <g ref={rocketRef}>
        <RocketShip />
      </g>
    </svg>
  )
}
