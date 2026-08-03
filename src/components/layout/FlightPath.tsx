import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { ScrollTrigger } from '../../lib/scrollTrigger'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useLightExperience, useTouchDevice } from '../../hooks/useTouchDevice'
import { useMissionPath } from '../../hooks/useMissionPath'
import {
  buildScrollPathMapping,
  computeWaypointArcLengths,
  getPathLength,
  mapScrollToPathProgress,
  waypointPathProgress,
  type ScrollPathMapping,
} from '../../lib/missionPath'
import { RocketShip } from './RocketShip'
import { useMissionUpdater } from '../../context/missionState'

interface FlightPathProps {
  containerRef: RefObject<HTMLElement | null>
}

const ROCKET_LOOKAHEAD = 14

/**
 * A long pause (background tab, an inactive canvas, a stalled main thread)
 * must not produce one enormous integration step on resume.
 */
const MAX_DT = 0.05

/** Follow rates, in "e-foldings per second". Higher = tighter to the input. */
const PROGRESS_RATE = 9
const SPEED_RATE = 6
const BANK_RATE = 5.5
const DOT_RATE = 5

/** Below this the smoothed value is snapped to target so the loop can idle. */
const PROGRESS_EPSILON = 0.00004
const SPEED_EPSILON = 0.00015

const MAX_BANK = 14
const BANK_GAIN = 58
/** How quickly travel speed cancels the parked idle wobble. */
const IDLE_FADE = 9

/** Frame-rate independent exponential approach. */
function damp(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt))
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

interface DotElements {
  outer: SVGCircleElement | null
  inner: SVGCircleElement | null
  ring: SVGCircleElement | null
}

/**
 * One waypoint arrival, painted from a single 0–1 activation value.
 *
 * The three rings do not all land on the same frame: the outer ring opens
 * first, the core lights a beat later, and the halo pulses last. Reading a
 * single eased value keeps them in lockstep with each other while still
 * arriving in a considered order.
 */
function paintDot(el: DotElements, a: number): void {
  const outerT = easeOutCubic(clamp01(a / 0.6))
  const innerT = easeOutCubic(clamp01((a - 0.22) / 0.5))
  const ringT = easeOutCubic(clamp01((a - 0.45) / 0.55))

  if (el.outer) {
    el.outer.setAttribute('r', (6 + 4 * outerT).toFixed(2))
    el.outer.setAttribute('fill', `rgba(129, 140, 248, ${(0.12 * outerT).toFixed(3)})`)
    const r = Math.round(148 + (129 - 148) * outerT)
    const g = Math.round(163 + (140 - 163) * outerT)
    const b = Math.round(184 + (248 - 184) * outerT)
    el.outer.setAttribute('stroke', `rgba(${r}, ${g}, ${b}, ${(0.2 + 0.8 * outerT).toFixed(3)})`)
    el.outer.setAttribute('stroke-width', (1 + 0.5 * outerT).toFixed(2))
  }
  if (el.inner) {
    el.inner.setAttribute('r', (3 * innerT).toFixed(2))
    el.inner.setAttribute('opacity', (0.95 * innerT).toFixed(3))
  }
  if (el.ring) {
    el.ring.setAttribute('r', (9 + 5 * ringT).toFixed(2))
    // Brief brightening through the middle of the expansion, settling to 0.35.
    const flash = ringT * (1 - ringT) * 4
    el.ring.setAttribute('opacity', (0.35 * ringT + 0.22 * flash).toFixed(3))
  }
}

export function FlightPath({ containerRef }: FlightPathProps) {
  const pathRef = useRef<SVGPathElement>(null)
  const rocketRef = useRef<SVGGElement>(null)
  const trailRef = useRef<SVGPathElement>(null)
  const dotRefs = useRef<(SVGGElement | null)[]>([])
  const dotElsRef = useRef<DotElements[]>([])
  const dotStateRef = useRef<{ id: string; a: number; applied: number }[]>([])
  /** Activation survives a remeasure so arrivals do not replay on resize. */
  const dotActivationRef = useRef<Record<string, number>>({})
  const reduced = useReducedMotion()
  const light = useLightExperience()
  const touch = useTouchDevice()
  const { pathD, waypoints, height, width, ready } = useMissionPath(containerRef)
  const [arcLengths, setArcLengths] = useState<number[]>([])
  const [totalLength, setTotalLength] = useState(0)
  const { update: updateMission, markAllReached } = useMissionUpdater()
  const pathLengthRef = useRef(0)
  const checkpointsRef = useRef<{ id: string; at: number }[]>([])

  useEffect(() => {
    const path = pathRef.current
    if (!path || !ready || waypoints.length < 2) return

    const length = getPathLength(path)
    pathLengthRef.current = length
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
    checkpointsRef.current = checkpoints
  }, [checkpoints])

  /**
   * Cache the dot sub-elements once per layout. Doing three querySelector
   * calls per dot per frame was most of the old dot cost, and was the reason
   * activation had to be throttled to 100ms (which is what made it snap).
   */
  useEffect(() => {
    dotRefs.current.length = waypoints.length
    dotElsRef.current = waypoints.map((_, i) => {
      const group = dotRefs.current[i]
      return {
        outer: group ? group.querySelector<SVGCircleElement>('[data-dot-outer]') : null,
        inner: group ? group.querySelector<SVGCircleElement>('[data-dot-inner]') : null,
        ring: group ? group.querySelector<SVGCircleElement>('[data-dot-ring]') : null,
      }
    })
    dotStateRef.current = waypoints.map((wp) => ({
      id: wp.id,
      a: dotActivationRef.current[wp.id] ?? 0,
      applied: -1,
    }))
  }, [waypoints, reduced])

  useEffect(() => {
    if (reduced || !ready || !containerRef.current || arcLengths.length < 2 || totalLength <= 0) {
      return
    }

    const container = containerRef.current
    const path = pathRef.current
    if (!path) return

    let mapping: ScrollPathMapping | null = buildScrollPathMapping(
      container,
      waypoints,
      arcLengths,
      totalLength,
    )
    let viewportHeight = window.innerHeight
    let scrollY = window.scrollY

    // The rocket lands where the reader already is - no fly-in on mount.
    let target = mapping ? mapScrollToPathProgress(scrollY, mapping) : 0
    let current = target

    let raf = 0
    let running = false
    let lastTime = 0
    let elapsed = 0
    let speed = 0
    let bank = 0
    let bankTarget = 0
    let dotsSettled = false

    let lastDrawn = -1
    let pathShown = -1
    let trailShown = -1
    let lastPointProgress = Number.NaN
    let pointX = 0
    let pointY = 0
    let heading = 0

    let lastMissionUpdate = 0
    const missionInterval = light ? 100 : 50

    const exhaust = rocketRef.current
      ? rocketRef.current.querySelector<SVGEllipseElement>('[data-rocket-exhaust]')
      : null

    path.style.strokeDashoffset = '0'
    if (trailRef.current) trailRef.current.style.strokeDashoffset = '0'

    const applyPathDraw = (p: number) => {
      const length = pathLengthRef.current
      if (length <= 0) return

      const drawn = Math.min(length, Math.max(0, length * p))
      if (Math.abs(drawn - lastDrawn) < 0.05) return
      lastDrawn = drawn

      const total = length.toFixed(2)
      path.style.strokeDasharray = `${drawn.toFixed(2)} ${total}`

      // A dash of length ~0 under a round linecap can still paint a stray cap
      // dot at the path origin. Hiding the stroke outright removes the flicker.
      const shown = drawn > 0.6 ? 1 : 0
      if (shown !== pathShown) {
        pathShown = shown
        path.style.opacity = shown ? '1' : '0'
      }

      const trail = trailRef.current
      if (!trail) return
      const trailLen = Math.max(0, drawn - 12)
      trail.style.strokeDasharray = `${trailLen.toFixed(2)} ${total}`
      const trailVisible = trailLen > 0.6 ? 1 : 0
      if (trailVisible !== trailShown) {
        trailShown = trailVisible
        trail.style.opacity = trailVisible ? '0.12' : '0'
      }
    }

    /** Returns true while the rocket is anywhere near the viewport. */
    const applyRocket = (p: number, dt: number): boolean => {
      const rocket = rocketRef.current
      const length = pathLengthRef.current
      if (touch || !rocket || length <= 0) return false

      // getPointAtLength is the expensive part; skip it when parked.
      if (p !== lastPointProgress) {
        lastPointProgress = p
        const tip = Math.min(length, Math.max(0, length * p))
        const point = path.getPointAtLength(tip)
        const ahead = path.getPointAtLength(Math.min(length, tip + ROCKET_LOOKAHEAD))
        pointX = point.x
        pointY = point.y
        const dx = ahead.x - point.x
        const dy = ahead.y - point.y
        // Nose follows the path tangent; +90 because the rocket art points up.
        heading = (Math.atan2(dy, dx) * 180) / Math.PI + 90
        const dist = Math.hypot(dx, dy) || 1
        const lateral = (dx / dist) * speed * BANK_GAIN
        bankTarget = Math.max(-MAX_BANK, Math.min(MAX_BANK, lateral))
      } else {
        bankTarget = 0
      }

      // Bank leads the turn: the ship rolls into its lateral velocity and
      // rolls back out as it settles, so it reads as flying rather than sliding.
      bank = damp(bank, bankTarget, BANK_RATE, dt)

      const thrust = Math.min(1, Math.abs(speed) * 14)
      const calm = 1 - Math.min(1, Math.abs(speed) * IDLE_FADE)
      const wobble = light
        ? 0
        : calm * (Math.sin(elapsed * 1.15) * 0.7 + Math.sin(elapsed * 0.47 + 1.3) * 0.35)

      rocket.setAttribute(
        'transform',
        `translate(${pointX.toFixed(2)}, ${pointY.toFixed(2)}) rotate(${(heading + bank + wobble).toFixed(2)})`,
      )

      if (exhaust) {
        const ry = 8 + thrust * 7 + (light ? 0 : calm * 0.6 * Math.sin(elapsed * 6.3))
        exhaust.setAttribute('ry', ry.toFixed(2))
        exhaust.setAttribute('cy', (6 + ry).toFixed(2))
        exhaust.setAttribute('opacity', (0.32 + thrust * 0.48).toFixed(3))
      }

      if (!mapping) return true
      const viewY = mapping.containerTop + pointY - scrollY
      return viewY > -180 && viewY < viewportHeight + 180
    }

    const applyDots = (p: number, dt: number) => {
      const states = dotStateRef.current
      const els = dotElsRef.current
      const cps = checkpointsRef.current
      let settled = true

      for (let i = 0; i < states.length; i++) {
        const state = states[i]
        const el = els[i]
        const cp = cps[i]
        if (!state || !el || !cp) continue

        const goal = p >= cp.at - 0.015 ? 1 : 0
        state.a = damp(state.a, goal, DOT_RATE, dt)
        if (Math.abs(goal - state.a) < 0.001) state.a = goal
        else settled = false

        dotActivationRef.current[state.id] = state.a
        if (Math.abs(state.a - state.applied) < 0.0015) continue
        state.applied = state.a
        paintDot(el, state.a)
      }

      dotsSettled = settled
    }

    function frame(now: number) {
      const dt = Math.min(MAX_DT, Math.max(0, (now - lastTime) / 1000))
      lastTime = now
      elapsed += dt

      const previous = current
      current = damp(current, target, PROGRESS_RATE, dt)
      if (Math.abs(target - current) < PROGRESS_EPSILON) current = target

      const rate = dt > 0 ? (current - previous) / dt : 0
      speed = damp(speed, rate, SPEED_RATE, dt)
      if (Math.abs(speed) < SPEED_EPSILON && current === target) speed = 0

      applyPathDraw(current)
      const nearViewport = applyRocket(current, dt)
      applyDots(current, dt)

      if (now - lastMissionUpdate > missionInterval) {
        lastMissionUpdate = now
        updateMission(current, checkpointsRef.current)
      }

      // Idle life is only worth paying for while the ship is on screen; once
      // it is parked off screen the loop stops entirely and scroll wakes it.
      const settled = current === target && speed === 0 && dotsSettled
      if (settled && !nearViewport) {
        running = false
        return
      }

      raf = requestAnimationFrame(frame)
    }

    const wake = () => {
      if (running) return
      running = true
      lastTime = performance.now()
      raf = requestAnimationFrame(frame)
    }

    const onScroll = () => {
      scrollY = window.scrollY
      if (mapping) target = mapScrollToPathProgress(scrollY, mapping)
      wake()
    }

    const remeasure = () => {
      viewportHeight = window.innerHeight
      mapping = buildScrollPathMapping(container, waypoints, arcLengths, totalLength)
      scrollY = window.scrollY
      if (mapping) target = mapScrollToPathProgress(scrollY, mapping)
      lastPointProgress = Number.NaN
      lastDrawn = -1
      wake()
    }

    const st = ScrollTrigger.create({
      trigger: container,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: onScroll,
    })

    // ScrollTrigger only reports between start and end; the native listener
    // guarantees the loop still wakes past the trigger (in the footer).
    // Both handlers are pure arithmetic - no layout reads in the scroll path.
    window.addEventListener('scroll', onScroll, { passive: true })
    ScrollTrigger.addEventListener('refresh', remeasure)
    window.addEventListener('resize', remeasure)

    wake()

    return () => {
      cancelAnimationFrame(raf)
      running = false
      st.kill()
      window.removeEventListener('scroll', onScroll)
      ScrollTrigger.removeEventListener('refresh', remeasure)
      window.removeEventListener('resize', remeasure)
    }
  }, [
    reduced,
    ready,
    containerRef,
    waypoints,
    arcLengths,
    totalLength,
    updateMission,
    light,
    touch,
  ])

  useEffect(() => {
    if (reduced && ready && checkpoints.length > 0) markAllReached(checkpoints)
  }, [reduced, ready, checkpoints, markAllReached])

  /**
   * Reduced motion: the path is simply already flown. The rocket is parked at
   * the far end on its final heading - without this it kept its untouched
   * identity transform and sat in the top-left corner of the SVG.
   */
  useEffect(() => {
    const path = pathRef.current
    if (!reduced || !path) return

    const length = getPathLength(path)
    if (length <= 0) return

    path.style.strokeDasharray = `${length} ${length}`
    path.style.strokeDashoffset = '0'
    path.style.opacity = '1'

    const trail = trailRef.current
    if (trail) {
      trail.style.strokeDasharray = `${Math.max(0, length - 12)} ${length}`
      trail.style.strokeDashoffset = '0'
      trail.style.opacity = '0.12'
    }

    const rocket = rocketRef.current
    if (rocket) {
      const end = path.getPointAtLength(length)
      const back = path.getPointAtLength(Math.max(0, length - ROCKET_LOOKAHEAD))
      const angle = (Math.atan2(end.y - back.y, end.x - back.x) * 180) / Math.PI
      rocket.setAttribute(
        'transform',
        `translate(${end.x.toFixed(2)}, ${end.y.toFixed(2)}) rotate(${(angle + 90).toFixed(2)})`,
      )
    }
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
        {!light && (
          <filter id="path-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/*
        Waypoint dots render in their idle (or, under reduced motion, their
        final) state and are then animated imperatively. Nothing here may be
        re-rendered from scroll state: React writing `r`/`fill` back on every
        tick is exactly what made arrivals flip in a single frame.
      */}
      {waypoints.map((wp, i) => (
        <g
          key={wp.id}
          ref={(el) => {
            dotRefs.current[i] = el
          }}
        >
          <circle
            data-dot-outer
            cx={wp.x}
            cy={wp.y}
            r={reduced ? 10 : 6}
            fill={reduced ? 'rgba(129, 140, 248, 0.12)' : 'rgba(129, 140, 248, 0)'}
            stroke={reduced ? 'rgba(129, 140, 248, 1)' : 'rgba(148, 163, 184, 0.2)'}
            strokeWidth={reduced ? 1.5 : 1}
          />
          <circle
            data-dot-inner
            cx={wp.x}
            cy={wp.y}
            r={reduced ? 3 : 0}
            fill="#c7d2fe"
            opacity={reduced ? 0.95 : 0}
          />
          <circle
            data-dot-ring
            cx={wp.x}
            cy={wp.y}
            r={reduced ? 14 : 9}
            fill="none"
            stroke="#818cf8"
            strokeWidth="0.5"
            opacity={reduced ? 0.35 : 0}
          />
        </g>
      ))}

      <path
        ref={trailRef}
        d={pathD}
        fill="none"
        stroke="url(#path-gradient)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ strokeDasharray: '0 1', strokeDashoffset: 0, opacity: 0 }}
      />

      <path
        ref={pathRef}
        d={pathD}
        fill="none"
        stroke="url(#path-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={light ? undefined : 'url(#path-glow)'}
        style={{ strokeDasharray: '0 1', strokeDashoffset: 0, opacity: 0 }}
      />

      <g ref={rocketRef} style={{ display: touch ? 'none' : undefined }}>
        <RocketShip />
      </g>
    </svg>
  )
}
