import { Suspense, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { useMotionValue, useMotionValueEvent, type MotionValue } from 'motion/react'
import * as THREE from 'three'
import { useIntersectionPause } from '../../hooks/useIntersectionPause'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useThrottledMotionValue } from '../../hooks/useThrottledMotionValue'
import {
  FEATURED_AIRFOIL_PROFILES,
  RESEARCH_AIRFOIL_PROFILES,
  SPAN_DEPTH,
  buildAirfoilSolidGeometry,
  buildProfileLinePoints,
  getMorphState,
  smoothstep,
  type AirfoilProfile,
  type MorphState,
} from '../../lib/airfoilGeometry'
import { ResearchViewerFrame, ViewerTelemetry } from '../research/ResearchViewerFrame'

const FLOW_COLOR = '#60a5fa'
const SUCTION_COLOR = '#818cf8'
const LIFT_COLOR = '#86efac'
const DRAG_COLOR = '#fbbf24'

/**
 * Longest frame step any smoother in this file will honour.
 *
 * The canvas sits on frameloop="demand" whenever it is off screen, so the first
 * delta after it wakes is the whole wall-clock gap. Without this clamp that one
 * frame would drive every eased value straight onto its target, which is the
 * lurch the smoothing exists to avoid.
 */
const MAX_DELTA = 0.05

/** Exponential approach rates, per second. */
const PROGRESS_FOLLOW_RATE = 11
/** Softer rate used while the model is being handed back after a drag. */
const PROGRESS_RECOVER_RATE = 4.5
const MANUAL_GRAB_RATE = 22
const MANUAL_RELEASE_RATE = 6
const AOA_FOLLOW_RATE = 15
const CAMERA_FOLLOW_RATE = 6.5
/** Stands in for "no easing at all" under prefers-reduced-motion. */
const SNAP_RATE = 1e4

/** Ribbon dash pattern. The stream offset wraps on exactly this period. */
const RIBBON_DASH_SIZE = 0.09
const RIBBON_GAP_SIZE = 0.055
const RIBBON_DASH_PERIOD = RIBBON_DASH_SIZE + RIBBON_GAP_SIZE
/** Dash travel in world units per second, plus the gain once flow is optimized. */
const RIBBON_STREAM_SPEED = 0.42
const RIBBON_STREAM_GAIN = 0.26

/** Read-out damping: rate per second, settle threshold, and emit interval. */
const READOUT_RATE = 8
const READOUT_EPSILON = 2e-4
const READOUT_EMIT_MS = 40

type ProgressRef = React.RefObject<number | null>

/**
 * Frame-rate independent exponential approach.
 * `dt` must already be clamped by the caller.
 */
function approach(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt))
}

/** Pointer-drag override for angle of attack. Blend 0 = scroll owns the model. */
interface ManualControl {
  active: boolean
  /** Target angle in degrees while the visitor is in control. */
  aoa: number
  /** 0 → scroll-scrubbed attitude, 1 → dragged attitude. */
  blend: number
  /** Approach rate per second while taking control. Quick, so a grab feels attached. */
  grabRate: number
  /** Approach rate per second while handing back. Slow, so a release reads as a settle. */
  releaseRate: number
  /** Scene progress the tunnel is parked at while the visitor is in control. */
  hold: number
}
type ManualRef = React.RefObject<ManualControl>

const MANUAL_AOA_MIN = -6
const MANUAL_AOA_MAX = 14
const MANUAL_DEG_PER_PX = 0.05
/** Idle time after release before scroll takes the model back. */
const MANUAL_RELEASE_MS = 1500

/**
 * Structural view of the Line2 object drei hands back through `ref`.
 *
 * The material used to be captured with `onUpdate`, but drei spreads its rest
 * props onto both the line and its material, so R3F fires that callback with
 * the material too - and a material has no `.material`, which is exactly how
 * this ref array ended up holding an undefined entry. Reading the material off
 * the line each frame cannot go stale, and every read is still guarded because
 * an exception inside useFrame tears down the whole render loop for this canvas.
 */
interface RibbonLine {
  material: { opacity: number; dashOffset: number }
}

function range01(value: number, start: number, end: number) {
  return THREE.MathUtils.clamp((value - start) / (end - start), 0, 1)
}

/**
 * Eases a displayed number toward its target on a self-terminating rAF loop.
 *
 * The scene keeps consuming scroll at full rate; only the read-out is damped,
 * so the coefficients settle into place instead of flickering through digits
 * every time the scroll position jitters.
 */
function useDampedReadout(target: number, rate: number): number {
  const [shown, setShown] = useState(target)
  const valueRef = useRef(target)
  const targetRef = useRef(target)
  const frameRef = useRef(0)

  useEffect(() => {
    targetRef.current = target
    // A loop that is already running will pick the new target up on its next
    // step, and there is nothing to animate once the two agree.
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

/**
 * Single owner of the progress the tunnel is drawn at, and of the manual blend.
 *
 * Everything downstream reads `sceneRef`, never raw scroll. Releasing the model
 * used to re-point the scene at the live scroll value in one assignment, so the
 * geometry, camera and force balance all jumped to wherever the page had got to
 * during the drag. Now grabbing parks the target where the scene already is and
 * releasing eases it back, so both directions of the hand-off are continuous.
 *
 * Runs at priority -1 so it lands before every consumer in the same frame.
 * Negative priorities sort first without switching R3F into manual-render mode.
 */
function SceneDriver({
  scrollTargetRef,
  sceneRef,
  manualRef,
}: {
  scrollTargetRef: ProgressRef
  sceneRef: React.RefObject<number>
  manualRef: ManualRef
}) {
  useFrame((_, delta) => {
    const dt = Math.min(delta, MAX_DELTA)
    const manual = manualRef.current
    if (!manual) return

    manual.blend = approach(
      manual.blend,
      manual.active ? 1 : 0,
      manual.active ? manual.grabRate : manual.releaseRate,
      dt,
    )
    if (!manual.active && manual.blend < 0.0005) manual.blend = 0

    const target = manual.active
      ? manual.hold
      : THREE.MathUtils.clamp(scrollTargetRef.current ?? 0, 0, 1)
    // Rate is interpolated rather than switched so the recovery never changes
    // speed in a single frame.
    const rate = THREE.MathUtils.lerp(PROGRESS_FOLLOW_RATE, PROGRESS_RECOVER_RATE, manual.blend)
    sceneRef.current = approach(sceneRef.current, target, rate, dt)
  }, -1)

  return null
}

function CameraRig({ progressRef, reduced }: { progressRef: ProgressRef; reduced: boolean }) {
  const { camera } = useThree()
  const positionRef = useRef(new THREE.Vector3())
  const targetRef = useRef(new THREE.Vector3())
  const lookRef = useRef(new THREE.Vector3(-0.18, 0.02, 0))
  const clockRef = useRef(0)
  const primedRef = useRef(false)

  useFrame((_, delta) => {
    const dt = Math.min(delta, MAX_DELTA)
    clockRef.current += dt
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const flow = smoothstep(range01(p, 0.08, 0.32))
    const section = smoothstep(range01(p, 0.32, 0.58))
    const settle = smoothstep(range01(p, 0.8, 1))
    const position = positionRef.current
    const target = targetRef.current

    // Idle breath, an order of magnitude below the smallest scroll-driven move,
    // so a parked scene is alive without competing with the scrub.
    const t = clockRef.current
    const breathX = reduced ? 0 : Math.sin(t * 0.21) * 0.022
    const breathY = reduced ? 0 : Math.sin(t * 0.17 + 1.3) * 0.015

    position.set(
      THREE.MathUtils.lerp(2.7, 0.2, section) + settle * 0.16 + breathX,
      THREE.MathUtils.lerp(1.25, 0.3, flow) + settle * 0.1 + breathY,
      THREE.MathUtils.lerp(4.75, 4.2, section) - settle * 0.18,
    )
    target.set(THREE.MathUtils.lerp(-0.18, 0.08, section), 0.02, 0)

    if (!primedRef.current) {
      // First drawn frame lands on the pose for the current scroll position
      // rather than gliding in from the constructor pose.
      primedRef.current = true
      camera.position.copy(position)
      lookRef.current.copy(target)
    } else {
      const k = 1 - Math.exp(-CAMERA_FOLLOW_RATE * dt)
      camera.position.lerp(position, k)
      // The aim point follows on the same curve as the body. It used to be
      // assigned raw, so the rig translated smoothly while its rotation tracked
      // scroll one-to-one.
      lookRef.current.lerp(target, k)
    }
    camera.lookAt(lookRef.current)
  })
  return null
}

function WindTunnel() {
  return (
    <group>
      <mesh position={[0, -0.88, 0]} receiveShadow>
        <boxGeometry args={[5.3, 0.12, 2.25]} />
        <meshPhysicalMaterial color="#0b1220" metalness={0.72} roughness={0.28} clearcoat={0.25} />
      </mesh>
      <mesh position={[0, 0.82, -0.92]}>
        <boxGeometry args={[5.3, 0.055, 0.08]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
      </mesh>
      {[-1.02, 1.02].map((z) => (
        <mesh key={z} position={[0, 0, z]}>
          <boxGeometry args={[5.2, 1.72, 0.035]} />
          <meshPhysicalMaterial
            color="#64748b"
            transmission={0.86}
            thickness={0.1}
            roughness={0.08}
            transparent
            opacity={0.09}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
      {[-2.45, 2.45].map((x) => (
        <group key={x} position={[x, -0.02, 0]}>
          <mesh>
            <torusGeometry args={[0.92, 0.055, 10, 64]} />
            <meshStandardMaterial color="#64748b" metalness={0.86} roughness={0.2} />
          </mesh>
          <mesh>
            <torusGeometry args={[0.83, 0.012, 6, 64]} />
            <meshStandardMaterial
              color={FLOW_COLOR}
              emissive={FLOW_COLOR}
              emissiveIntensity={0.75}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -0.81, 0.78]}>
        <boxGeometry args={[4.8, 0.018, 0.035]} />
        <meshStandardMaterial
          color={FLOW_COLOR}
          emissive={FLOW_COLOR}
          emissiveIntensity={0.8}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

function StingMount() {
  return (
    <group position={[0, -0.5, -0.2]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.075, 0.11, 1.15, 20]} />
        <meshPhysicalMaterial color="#64748b" metalness={0.9} roughness={0.18} clearcoat={0.35} />
      </mesh>
      <mesh position={[-0.58, -0.14, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.18, 0.52, 24]} />
        <meshStandardMaterial color="#293548" metalness={0.82} roughness={0.24} />
      </mesh>
      <mesh position={[-0.58, -0.42, 0]}>
        <boxGeometry args={[0.52, 0.14, 0.58]} />
        <meshStandardMaterial color="#111827" metalness={0.75} roughness={0.3} />
      </mesh>
    </group>
  )
}

function FlowRibbons({
  progressRef,
  morphRef,
}: {
  progressRef: ProgressRef
  morphRef: React.RefObject<MorphState | null>
}) {
  const lineGroups = useRef<(THREE.Group | null)[]>([])
  const lineObjects = useRef<(RibbonLine | null)[]>([])
  const streamRef = useRef(0)
  const lines = useMemo(() => {
    return Array.from({ length: 11 }, (_, index) => {
      const baseY = -0.68 + index * 0.136
      const points: THREE.Vector3[] = []
      for (let step = 0; step <= 34; step++) {
        const x = -2.55 + (step / 34) * 5.1
        const envelope = Math.exp(-Math.pow(x / 1.05, 2))
        const side = baseY >= 0 ? 1 : -1
        const displacement = side * envelope * (0.08 + (1 - Math.min(1, Math.abs(baseY))) * 0.12)
        const wake = x > 0.75 ? Math.sin((x - 0.75) * 4 + index) * 0.012 * (2.5 - x) : 0
        points.push(new THREE.Vector3(x, baseY + displacement + wake, 0.42 + (index % 2) * 0.025))
      }
      // Reveal walks outward from the pair that straddles the model, so the
      // field builds around the airfoil instead of switching on as one block.
      // The whole stagger still lands inside the original 0.10-0.30 window.
      const lead = (Math.abs(index - 5) / 5) * 0.06
      return {
        points,
        baseY,
        revealStart: 0.1 + lead,
        revealEnd: 0.24 + lead,
        // Neighbouring ribbons run their dashes out of phase, so the field
        // reads as many streaks rather than one moving comb.
        dashPhase: (index * 0.031) % RIBBON_DASH_PERIOD,
      }
    })
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, MAX_DELTA)
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const optimized = smoothstep(range01(p, 0.62, 0.9))
    const cl = morphRef.current?.cl ?? 0.82
    const lift = 1 + (cl - 0.8) * 0.16

    // The dashes are what streams now, not the group.
    //
    // The old loop slid the whole group along X and wrapped it on a 0.14
    // modulo, which does not even match the 0.145 dash period - so once per
    // wrap every ribbon shifted 0.14 world units in a single frame. Advancing
    // dashOffset instead is seamless by construction: the shader takes it
    // modulo the dash period, and wrapping the accumulator on exactly that
    // period keeps it small enough to stay precise in a float uniform.
    streamRef.current =
      (streamRef.current + dt * (RIBBON_STREAM_SPEED + optimized * RIBBON_STREAM_GAIN)) %
      RIBBON_DASH_PERIOD
    const stream = streamRef.current

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]
      if (!line) continue
      const reveal = smoothstep(range01(p, line.revealStart, line.revealEnd))

      // Both arrays below are filled by callback refs and can legitimately hold
      // a hole on the first frames after mount. Guarded individually: a throw
      // in here kills the render loop for the entire canvas.
      const group = lineGroups.current[index]
      if (group) {
        group.visible = reveal > 0.02
        group.scale.y = lift
      }

      const material = lineObjects.current[index]?.material
      if (!material) continue
      material.opacity = reveal * (0.12 + optimized * 0.08 + (index % 3) * 0.025)
      material.dashOffset = -(stream + line.dashPhase)
    }
  })

  return (
    <>
      {lines.map((line, index) => (
        <group
          key={index}
          ref={(group) => {
            lineGroups.current[index] = group
            return () => {
              lineGroups.current[index] = null
            }
          }}
          visible={false}
        >
          <Line
            ref={(object) => {
              lineObjects.current[index] = object
              return () => {
                lineObjects.current[index] = null
              }
            }}
            points={line.points}
            // Constant per ribbon, so it is a prop instead of a per-frame
            // Color.set() that re-parsed a hex string on every draw.
            color={index > 5 ? SUCTION_COLOR : FLOW_COLOR}
            transparent
            opacity={0}
            lineWidth={index === 5 || index === 6 ? 1.5 : 1}
            dashed
            dashSize={RIBBON_DASH_SIZE}
            gapSize={RIBBON_GAP_SIZE}
          />
        </group>
      ))}
    </>
  )
}

function MorphPulse({ progressRef }: { progressRef: ProgressRef }) {
  const ringRef = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const raw = Math.sin(range01(p, 0.36, 0.64) * Math.PI)
    // Smoothstepped envelope: the ring blooms and fades on an ease instead of
    // ramping straight off zero at both ends of the sweep.
    const pulse = raw * raw * (3 - 2 * raw)
    if (!ringRef.current) return
    ringRef.current.visible = pulse > 0.02
    ringRef.current.scale.setScalar(0.8 + pulse * 0.55)
    ;(ringRef.current.material as THREE.MeshBasicMaterial).opacity = pulse * 0.28
  })
  return (
    <mesh ref={ringRef} position={[0, 0, -0.25]} visible={false}>
      <ringGeometry args={[0.72, 0.75, 64]} />
      <meshBasicMaterial
        color={SUCTION_COLOR}
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

function AirfoilModel({
  progressRef,
  active,
  profiles,
  morphRef,
  manualRef,
  appliedAoaRef,
  reduced,
}: {
  progressRef: ProgressRef
  active: boolean
  profiles: AirfoilProfile[]
  morphRef: React.RefObject<MorphState | null>
  manualRef: ManualRef
  appliedAoaRef: React.RefObject<number>
  reduced: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const outlineRef = useRef<THREE.Line>(null)
  const geometryRef = useRef<THREE.BufferGeometry | null>(null)
  const outlineGeometryRef = useRef<THREE.BufferGeometry | null>(null)
  const lastKey = useRef('')

  const initialGeometry = useMemo(
    () => buildAirfoilSolidGeometry(profiles[0].points, SPAN_DEPTH * 2.8, profiles[0].cl),
    [profiles],
  )
  const initialOutline = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(buildProfileLinePoints(profiles[0].points, SPAN_DEPTH * 1.42), 3),
    )
    return geometry
  }, [profiles])
  const initialLine = useMemo(
    () =>
      new THREE.Line(
        initialOutline,
        new THREE.LineBasicMaterial({ color: '#f8fafc', transparent: true, opacity: 0.58 }),
      ),
    [initialOutline],
  )

  useEffect(
    () => () => {
      geometryRef.current?.dispose()
      outlineGeometryRef.current?.dispose()
      initialGeometry.dispose()
      initialOutline.dispose()
      ;(initialLine.material as THREE.Material).dispose()
    },
    [initialGeometry, initialOutline, initialLine],
  )

  useFrame((_, delta) => {
    if (!active) return
    const dt = Math.min(delta, MAX_DELTA)
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    // Double eased: smoothstep across the sweep window, then getMorphState
    // smoothsteps again inside each profile pair, so the shape settles onto
    // every profile instead of sliding through it at constant speed.
    const morphProgress = smoothstep(range01(p, 0.34, 0.82))
    const morph = getMorphState(morphProgress, profiles)
    morphRef.current = morph
    const key = `${morph.fromIndex}-${morph.toIndex}-${morph.t.toFixed(2)}`
    if (key !== lastKey.current) {
      lastKey.current = key
      const geometry = buildAirfoilSolidGeometry(morph.morphedPoints, SPAN_DEPTH * 2.8, morph.cl)
      const outline = new THREE.BufferGeometry()
      outline.setAttribute(
        'position',
        new THREE.BufferAttribute(buildProfileLinePoints(morph.morphedPoints, SPAN_DEPTH * 1.42), 3),
      )
      geometryRef.current?.dispose()
      outlineGeometryRef.current?.dispose()
      geometryRef.current = geometry
      outlineGeometryRef.current = outline
      if (meshRef.current) meshRef.current.geometry = geometry
      if (outlineRef.current) outlineRef.current.geometry = outline
    }

    // SceneDriver owns manual.blend; this only reads it.
    const manual = manualRef.current
    const blend = manual ? manual.blend : 0
    const manualAoa = manual ? manual.aoa : 0

    const scrollAoa = THREE.MathUtils.lerp(2, morph.aoa, smoothstep(range01(p, 0.18, 0.48)))
    // The attitude the model is asked for, and the attitude it actually holds.
    // Damping the second one means neither the blend crossing nor a fast drag
    // can put a step into the rotation, and it is what handlePointerDown seeds
    // the next grab from - so picking the model up can never jump it.
    const targetAoa = THREE.MathUtils.lerp(scrollAoa, manualAoa, blend)
    appliedAoaRef.current = approach(
      appliedAoaRef.current,
      targetAoa,
      reduced ? SNAP_RATE : AOA_FOLLOW_RATE,
      dt,
    )

    const group = groupRef.current
    if (group) {
      group.rotation.z = THREE.MathUtils.degToRad(appliedAoaRef.current)
      group.rotation.y = THREE.MathUtils.lerp(0.05, -0.08, smoothstep(range01(p, 0.75, 1)))
    }
  })

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} geometry={initialGeometry} castShadow>
        <meshPhysicalMaterial
          vertexColors
          metalness={0.34}
          roughness={0.23}
          clearcoat={0.65}
          clearcoatRoughness={0.16}
          side={THREE.DoubleSide}
        />
      </mesh>
      <primitive ref={outlineRef} object={initialLine} />
      <MorphPulse progressRef={progressRef} />
    </group>
  )
}

function ForceBalance({
  progressRef,
  morphRef,
}: {
  progressRef: ProgressRef
  morphRef: React.RefObject<MorphState | null>
}) {
  const liftRef = useRef<THREE.Mesh>(null)
  const dragRef = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    // Lift leads, drag follows a beat later: the two bars used to extend as one
    // block, which read cheaper than it needed to.
    const liftReveal = smoothstep(range01(p, 0.18, 0.38))
    const dragReveal = smoothstep(range01(p, 0.22, 0.44))
    const morph = morphRef.current
    if (!morph || !liftRef.current || !dragRef.current) return
    liftRef.current.scale.y = liftReveal * (0.28 + morph.cl * 0.3)
    dragRef.current.scale.x = dragReveal * (0.2 + morph.cd * 5.5)
    ;(liftRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
      0.5 + liftReveal * 1.6
    ;(dragRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
      0.5 + dragReveal * 1.2
  })
  return (
    <group position={[1.45, -0.63, 0.58]}>
      <mesh ref={liftRef} position={[0, 0.18, 0]}>
        <boxGeometry args={[0.035, 0.7, 0.035]} />
        <meshStandardMaterial color={LIFT_COLOR} emissive={LIFT_COLOR} emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      <mesh ref={dragRef} position={[0.18, 0, 0]}>
        <boxGeometry args={[0.7, 0.035, 0.035]} />
        <meshStandardMaterial color={DRAG_COLOR} emissive={DRAG_COLOR} emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.18, 0.1, 0.14]} />
        <meshPhysicalMaterial color="#334155" metalness={0.82} roughness={0.22} />
      </mesh>
    </group>
  )
}

/**
 * Memoized because the damped read-out re-renders the wrapper more often than
 * the throttled value used to. Every prop here is a stable ref or constant, so
 * the scene tree is only reconciled when visibility or reduced-motion changes.
 */
const TunnelScene = memo(function TunnelScene({
  scrollTargetRef,
  sceneProgressRef,
  active,
  profiles,
  manualRef,
  appliedAoaRef,
  reduced,
}: {
  scrollTargetRef: ProgressRef
  sceneProgressRef: React.RefObject<number>
  active: boolean
  profiles: AirfoilProfile[]
  manualRef: ManualRef
  appliedAoaRef: React.RefObject<number>
  reduced: boolean
}) {
  const morphRef = useRef<MorphState | null>(null)
  return (
    <>
      {/* First child on purpose: it has to publish this frame's progress before
          anything reads it. */}
      <SceneDriver
        scrollTargetRef={scrollTargetRef}
        sceneRef={sceneProgressRef}
        manualRef={manualRef}
      />
      <color attach="background" args={['#040711']} />
      <fog attach="fog" args={['#040711', 6.5, 10]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[4, 5, 5]} intensity={1.7} color="#f8fafc" castShadow />
      <directionalLight position={[-4, 2, 3]} intensity={0.72} color={SUCTION_COLOR} />
      <pointLight position={[-2.2, 0, 1.4]} intensity={0.8} color={FLOW_COLOR} distance={4} />
      <pointLight position={[2.2, 0, 1.2]} intensity={0.45} color={LIFT_COLOR} distance={3} />
      <CameraRig progressRef={sceneProgressRef} reduced={reduced} />
      <WindTunnel />
      <StingMount />
      <FlowRibbons progressRef={sceneProgressRef} morphRef={morphRef} />
      <AirfoilModel
        progressRef={sceneProgressRef}
        active={active}
        profiles={profiles}
        morphRef={morphRef}
        manualRef={manualRef}
        appliedAoaRef={appliedAoaRef}
        reduced={reduced}
      />
      <ForceBalance progressRef={sceneProgressRef} morphRef={morphRef} />
    </>
  )
})

function getTelemetry(progress: number, profiles: AirfoilProfile[]) {
  const p = THREE.MathUtils.clamp(progress, 0, 1)
  const morphProgress = smoothstep(range01(p, 0.34, 0.82))
  const morph = getMorphState(morphProgress, profiles)
  let phase = 'Tunnel idle'
  let detail = 'Baseline model installed'
  let mode = 'STANDBY'
  if (p >= 0.82) {
    phase = 'Performance lock'
    detail = 'Optimized profile verified'
    mode = 'OPTIMUM'
  } else if (p >= 0.62) {
    phase = 'Optimized settle'
    detail = 'Wake recovery confirmed'
    mode = 'VERIFY'
  } else if (p >= 0.38) {
    phase = 'Morph sweep'
    detail = 'QAOA geometry update'
    mode = 'MORPH'
  } else if (p >= 0.14) {
    phase = 'Flow onset'
    detail = 'Pressure field developing'
    mode = 'RUN'
  }
  return { morph, phase, detail, mode }
}

export interface MorphingAirfoilProps {
  scrollProgress?: number
  progress?: MotionValue<number>
  active?: boolean
  className?: string
  variant?: 'featured' | 'full'
}

export function MorphingAirfoil({
  scrollProgress = 0,
  progress,
  active = true,
  className = '',
  variant = 'featured',
}: MorphingAirfoilProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isVisible = useIntersectionPause(containerRef)
  /** Live scroll position. */
  const scrollTargetRef = useRef(scrollProgress)
  /** Damped position the scene is actually drawn at. Owned by SceneDriver. */
  const sceneProgressRef = useRef(scrollProgress)
  const primedRef = useRef(false)
  const fallbackProgress = useMotionValue(scrollProgress)
  const source = progress ?? fallbackProgress
  const profiles = variant === 'featured' ? FEATURED_AIRFOIL_PROFILES : RESEARCH_AIRFOIL_PROFILES
  const liveProgress = useThrottledMotionValue(source, 100)
  const reduced = useReducedMotion()
  const finePointer = useMediaQuery('(pointer: fine)', false)

  const manualRef = useRef<ManualControl>({
    active: false,
    aoa: 4,
    blend: 0,
    grabRate: MANUAL_GRAB_RATE,
    releaseRate: MANUAL_RELEASE_RATE,
    hold: scrollProgress,
  })
  const appliedAoaRef = useRef(2)
  const dragRef = useRef<{ id: number; startX: number; startAoa: number } | null>(null)
  const releaseTimerRef = useRef<number | null>(null)
  const [manualAoa, setManualAoa] = useState<number | null>(null)

  // Reduced motion: no eased hand-off, the attitude just changes.
  useEffect(() => {
    manualRef.current.grabRate = reduced ? SNAP_RATE : MANUAL_GRAB_RATE
    manualRef.current.releaseRate = reduced ? SNAP_RATE : MANUAL_RELEASE_RATE
  }, [reduced])

  useEffect(() => {
    if (!progress) fallbackProgress.set(scrollProgress)
  }, [progress, scrollProgress, fallbackProgress])
  useEffect(() => {
    const value = source.get()
    scrollTargetRef.current = value
    // Only on the very first pass: after that the driver eases, and stamping
    // the scene position here would reintroduce the snap it exists to remove.
    if (!primedRef.current) {
      primedRef.current = true
      sceneProgressRef.current = value
      manualRef.current.hold = value
    }
  }, [source, scrollProgress])
  useMotionValueEvent(source, 'change', (value) => {
    // Always recorded, even mid-drag. The scene stays parked because the driver
    // targets manual.hold while the visitor is in control, which means letting
    // go can ease onto the live value instead of being re-pointed at it.
    scrollTargetRef.current = value
  })

  const clearReleaseTimer = () => {
    if (releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current)
      releaseTimerRef.current = null
    }
  }

  useEffect(
    () => () => {
      if (releaseTimerRef.current !== null) window.clearTimeout(releaseTimerRef.current)
    },
    [],
  )

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!finePointer || event.pointerType !== 'mouse' || event.button !== 0) return
      clearReleaseTimer()
      const startAoa = THREE.MathUtils.clamp(
        manualRef.current.active ? manualRef.current.aoa : appliedAoaRef.current,
        MANUAL_AOA_MIN,
        MANUAL_AOA_MAX,
      )
      dragRef.current = { id: event.pointerId, startX: event.clientX, startAoa }
      manualRef.current.active = true
      manualRef.current.aoa = startAoa
      // Park the scene exactly where it already is. Both the target and the
      // seeded angle come from what is on screen this instant, so taking hold
      // of the model moves nothing.
      manualRef.current.hold = sceneProgressRef.current
      setManualAoa(startAoa)
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Pointer already released - the move/up handlers still work without capture.
      }
    },
    [finePointer],
  )

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.id !== event.pointerId) return
    const next = THREE.MathUtils.clamp(
      drag.startAoa + (event.clientX - drag.startX) * MANUAL_DEG_PER_PX,
      MANUAL_AOA_MIN,
      MANUAL_AOA_MAX,
    )
    manualRef.current.aoa = next
    setManualAoa((current) => (current !== null && Math.abs(current - next) < 0.1 ? current : next))
  }, [])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.id !== event.pointerId) return
    dragRef.current = null
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      // Capture already gone.
    }
    releaseTimerRef.current = window.setTimeout(() => {
      releaseTimerRef.current = null
      // Nothing is reassigned here any more. Clearing the flag lets the driver
      // ease progress and blend back toward live scroll on their own curves.
      manualRef.current.active = false
      setManualAoa(null)
    }, MANUAL_RELEASE_MS)
  }, [])

  const readoutRate = reduced ? SNAP_RATE : READOUT_RATE
  // Read-outs run off a damped copy of scroll so the digits settle instead of
  // stepping with every throttled sample. The 3D scene is unaffected.
  const shownProgress = useDampedReadout(liveProgress, readoutRate)
  const telemetry = getTelemetry(shownProgress, profiles)
  const manual = manualAoa !== null
  const shownAoa = useDampedReadout(
    manual ? (manualAoa as number) : telemetry.morph.aoa,
    readoutRate * 1.6,
  )

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={finePointer ? { cursor: manual ? 'grabbing' : 'grab', touchAction: 'pan-y' } : undefined}
    >
      <ResearchViewerFrame
        className={`${className} research-viewer--airfoil`}
        progressPercent={Math.round(shownProgress * 100)}
        hint={finePointer ? 'Drag ⇄ to set angle of attack' : undefined}
        telemetry={
          <ViewerTelemetry
            label="Wind tunnel"
            rows={[
              { key: 'Phase', value: manual ? 'Manual attitude' : telemetry.phase },
              { key: 'Profile', value: telemetry.morph.profile.label },
              // Coefficients are the profile's measured values, so they are held
              // (not recomputed) while the visitor is flying the model by hand.
              { key: 'Cₗ', value: manual ? '-' : telemetry.morph.cl.toFixed(2) },
              { key: 'Cᴅ', value: manual ? '-' : telemetry.morph.cd.toFixed(3) },
              { key: 'α', value: `${shownAoa.toFixed(1)}°` },
              { key: 'Mode', value: manual ? 'MANUAL' : telemetry.mode },
            ]}
          />
        }
        legend={
          <div className="research-viewer__legend">
            <span className="research-viewer__legend-item research-viewer__legend-item--flow">Stream field</span>
            <span className="research-viewer__legend-item research-viewer__legend-item--lift">Lift response</span>
            <span className="research-viewer__legend-item research-viewer__legend-item--drag">Drag response</span>
          </div>
        }
      >
        <Canvas
          camera={{ position: [2.7, 1.25, 4.75], fov: 38, near: 0.1, far: 30 }}
          dpr={[1, 1.5]}
          gl={{ alpha: true, antialias: false, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
          frameloop={isVisible && active ? 'always' : 'demand'}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <TunnelScene
              scrollTargetRef={scrollTargetRef}
              sceneProgressRef={sceneProgressRef}
              active={isVisible && active}
              profiles={profiles}
              manualRef={manualRef}
              appliedAoaRef={appliedAoaRef}
              reduced={reduced}
            />
          </Suspense>
        </Canvas>
        <div className="viewer-phase" aria-hidden="true">
          <span className="viewer-phase__index">{String(Math.min(4, Math.floor(shownProgress * 5)) + 1).padStart(2, '0')}</span>
          <span className="viewer-phase__copy">
            <strong>{manual ? 'Manual attitude' : telemetry.phase}</strong>
            <small>{manual ? 'Drag sets α - coefficients held' : telemetry.detail}</small>
          </span>
        </div>
      </ResearchViewerFrame>
    </div>
  )
}
