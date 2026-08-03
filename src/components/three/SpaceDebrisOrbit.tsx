import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { useMotionValue, useMotionValueEvent, type MotionValue } from 'motion/react'
import * as THREE from 'three'
import { useIntersectionPause } from '../../hooks/useIntersectionPause'
import { useMotionProgressRef } from '../../hooks/useMotionProgressRef'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useThrottledMotionValue } from '../../hooks/useThrottledMotionValue'
import { smoothstep } from '../../lib/airfoilGeometry'
import {
  ConferenceBadgeOverlay,
  ResearchViewerFrame,
  ViewerTelemetry,
} from '../research/ResearchViewerFrame'

const DEBRIS_COUNT = 180
const EARTH_RADIUS = 1.42
const ORBIT_RADIUS = 2.7
const CAPTURE_COLOR = '#86efac'
const RAIL_COLOR = '#fbbf24'
const ORBIT_COLOR = '#818cf8'

/**
 * Longest step any smoother here will integrate. This canvas runs on
 * frameloop="demand" while it is off screen, so the frame it wakes up on can
 * report a multi-second delta. Clamping keeps that from lurching.
 */
const MAX_DELTA = 0.05
/** Temporal smoothing on the raw scroll value, applied before anything reads it. */
const PROGRESS_LAMBDA = 12
/** Bigger jumps than this are a scrub, not a scroll: snap rather than ease. */
const PROGRESS_SNAP = 0.14
const CAMERA_LAMBDA = 6.2
const CAMERA_AIM_LAMBDA = 7.6
/** Past this much travel the camera has been teleported, so do not fly there. */
const CAMERA_SNAP_DISTANCE_SQ = 6.25

type ProgressRef = React.RefObject<number | null>

function range01(value: number, start: number, end: number) {
  return THREE.MathUtils.clamp((value - start) / (end - start), 0, 1)
}

function deterministic(index: number, salt: number) {
  return ((Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453) % 1 + 1) % 1
}

/** Frame-rate independent exponential approach. Stable under variable delta. */
function damp(current: number, target: number, lambda: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt))
}

function dampVector(current: THREE.Vector3, target: THREE.Vector3, lambda: number, dt: number) {
  current.lerp(target, 1 - Math.exp(-lambda * dt))
}

function easeOutCubic(t: number) {
  const inv = 1 - t
  return 1 - inv * inv * inv
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * A damped copy of the scroll value.
 *
 * Reading scroll progress raw maps every bit of wheel and trackpad jitter
 * straight onto the animation. Each rig keeps its own copy rather than sharing
 * mutable module state, and because they all integrate the same input with the
 * same constants on the same frame they stay in lockstep with each other.
 */
function useDampedProgress() {
  const state = useRef({ value: 0, primed: false })
  return useCallback((raw: number, dt: number) => {
    const s = state.current
    const target = THREE.MathUtils.clamp(raw, 0, 1)
    if (!s.primed) {
      s.primed = true
      s.value = target
    } else if (Math.abs(target - s.value) > PROGRESS_SNAP) {
      s.value = target
    } else {
      s.value = damp(s.value, target, PROGRESS_LAMBDA, dt)
    }
    return s.value
  }, [])
}

function CameraRig({ progressRef, reduced }: { progressRef: ProgressRef; reduced: boolean }) {
  const { camera } = useThree()
  const positionRef = useRef(new THREE.Vector3())
  const targetRef = useRef(new THREE.Vector3())
  const aimRef = useRef(new THREE.Vector3())
  const primedRef = useRef(false)
  const smoothProgress = useDampedProgress()

  useFrame((state, delta) => {
    const dt = Math.min(delta, MAX_DELTA)
    const p = smoothProgress(progressRef.current ?? 0, dt)
    const time = state.clock.elapsedTime
    const intercept = smoothstep(range01(p, 0.18, 0.38))
    const operation = smoothstep(range01(p, 0.38, 0.72))
    const pullback = smoothstep(range01(p, 0.78, 1))
    const position = positionRef.current
    const target = targetRef.current
    const aim = aimRef.current
    // Barely-there breathing so a scene parked mid-scroll still has parallax.
    const breath = reduced ? 0 : 1

    position.set(
      THREE.MathUtils.lerp(4.2, 3.25, intercept) + pullback * 0.8 + Math.sin(time * 0.21) * 0.05 * breath,
      THREE.MathUtils.lerp(2.0, 1.35, intercept) + pullback * 0.4 + Math.sin(time * 0.17 + 1.1) * 0.035 * breath,
      THREE.MathUtils.lerp(5.1, 4.25, operation) + pullback * 0.55,
    )
    // Opening frame is aimed between Earth and the vehicle rather than at the
    // origin; aiming at the origin pushed the vehicle into the right-hand edge
    // of the viewer, where it was clipped before the capture even started.
    target.set(
      THREE.MathUtils.lerp(0.42, 0.68, intercept) - pullback * 0.4,
      THREE.MathUtils.lerp(0.28, 0.45, operation),
      0,
    )

    if (!primedRef.current) {
      primedRef.current = true
      aim.copy(target)
    } else if (camera.position.distanceToSquared(position) > CAMERA_SNAP_DISTANCE_SQ) {
      camera.position.copy(position)
      aim.copy(target)
    } else {
      dampVector(camera.position, position, CAMERA_LAMBDA, dt)
      dampVector(aim, target, CAMERA_AIM_LAMBDA, dt)
    }
    camera.lookAt(aim)
  })
  return null
}

function Starfield() {
  const geometry = useMemo(() => {
    const positions = new Float32Array(420 * 3)
    for (let i = 0; i < 420; i++) {
      const radius = 7 + deterministic(i, 1) * 4
      const theta = deterministic(i, 2) * Math.PI * 2
      const phi = Math.acos(deterministic(i, 3) * 2 - 1)
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius
      positions[i * 3 + 1] = Math.cos(phi) * radius
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius
    }
    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return result
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#dbeafe" size={0.025} transparent opacity={0.72} sizeAttenuation />
    </points>
  )
}

function Earth() {
  const earthRef = useRef<THREE.Mesh>(null)
  const spinRef = useRef(0)
  useFrame((_, delta) => {
    // Integrated rather than derived from elapsed time, so the rotation rate can
    // never be multiplied back through the whole clock.
    spinRef.current = (spinRef.current + Math.min(delta, MAX_DELTA) * 0.025) % (Math.PI * 2)
    if (earthRef.current) earthRef.current.rotation.y = spinRef.current
  })
  return (
    <group position={[-1.25, -1.42, -0.72]}>
      <mesh ref={earthRef}>
        <icosahedronGeometry args={[EARTH_RADIUS, 5]} />
        <meshPhysicalMaterial
          color="#102b5d"
          emissive="#06142e"
          emissiveIntensity={0.75}
          metalness={0.04}
          roughness={0.68}
          clearcoat={0.15}
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[EARTH_RADIUS * 1.035, 5]} />
        <meshBasicMaterial
          color="#60a5fa"
          transparent
          opacity={0.13}
          side={THREE.BackSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2.6, 0.2, -0.2]}>
        <torusGeometry args={[EARTH_RADIUS * 1.32, 0.012, 6, 128]} />
        <meshBasicMaterial color={ORBIT_COLOR} transparent opacity={0.34} />
      </mesh>
    </group>
  )
}

function OrbitShells() {
  const shells = useMemo(
    () =>
      [-0.18, 0.08, 0.28].map((inclination, shell) => {
        const points: THREE.Vector3[] = []
        const radius = ORBIT_RADIUS + shell * 0.22
        for (let i = 0; i <= 128; i++) {
          const angle = (i / 128) * Math.PI * 2
          points.push(
            new THREE.Vector3(
              Math.cos(angle) * radius - 1.25,
              Math.sin(angle) * radius * Math.sin(inclination) - 1.42,
              Math.sin(angle) * radius * Math.cos(inclination) - 0.72,
            ),
          )
        }
        return points
      }),
    [],
  )

  return (
    <>
      {shells.map((points, index) => (
        <Line
          key={index}
          points={points}
          color={index === 1 ? '#c7d2fe' : ORBIT_COLOR}
          transparent
          opacity={index === 1 ? 0.3 : 0.14}
          lineWidth={index === 1 ? 1.2 : 0.8}
        />
      ))}
    </>
  )
}

function DebrisField({ progressRef, reduced }: { progressRef: ProgressRef; reduced: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const glowRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const smoothProgress = useDampedProgress()
  const states = useMemo(
    () =>
      Array.from({ length: DEBRIS_COUNT }, (_, index) => ({
        angle: deterministic(index, 4) * Math.PI * 2,
        inclination: (deterministic(index, 5) - 0.5) * 0.62,
        radius: ORBIT_RADIUS + (deterministic(index, 6) - 0.5) * 0.62,
        scale: 0.025 + deterministic(index, 7) * 0.052,
        speed: 0.018 + deterministic(index, 8) * 0.024,
        spin: deterministic(index, 9) * Math.PI,
      })),
    [],
  )

  useFrame((state, delta) => {
    const mesh = meshRef.current
    const glow = glowRef.current
    if (!mesh || !glow) return
    const dt = Math.min(delta, MAX_DELTA)
    const p = smoothProgress(progressRef.current ?? 0, dt)
    const tracking = smoothstep(range01(p, 0.1, 0.28))
    const cleared = smoothstep(range01(p, 0.42, 0.92))
    const time = state.clock.elapsedTime
    // Fractional edges rather than integer counts. The old floor() meant every
    // piece flipped between full size and 4% in a single frame.
    const trackedEdge = tracking * 28
    const clearedEdge = cleared * 82

    states.forEach((debris, index) => {
      const angle = debris.angle + time * debris.speed
      const clearT = THREE.MathUtils.clamp(clearedEdge - index, 0, 2) * 0.5
      // Ease in, so a piece hangs on then collapses as the sweep reaches it.
      const collapse = clearT * clearT
      const visibleScale = debris.scale * THREE.MathUtils.lerp(1, 0.04, collapse)
      dummy.position.set(
        Math.cos(angle) * debris.radius - 1.25,
        Math.sin(angle) * debris.radius * Math.sin(debris.inclination) - 1.42,
        Math.sin(angle) * debris.radius * Math.cos(debris.inclination) - 0.72,
      )
      dummy.rotation.set(debris.spin + time * 0.2, angle, debris.spin * 0.7)
      dummy.scale.set(visibleScale * 0.6, visibleScale * 1.8, visibleScale)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)

      const lockT = smoothstep(THREE.MathUtils.clamp(trackedEdge - index, 0, 1.5) / 1.5)
      const pulse = reduced ? 1 : 0.86 + Math.sin(time * 2.4 + index * 0.9) * 0.14
      const halo = lockT * (1 - collapse) * pulse
      dummy.scale.setScalar(Math.max(0.0001, visibleScale * 2.4 * halo))
      dummy.updateMatrix()
      glow.setMatrixAt(index, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    glow.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, DEBRIS_COUNT]}>
        <tetrahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#a8b2c3" metalness={0.86} roughness={0.32} />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[undefined, undefined, DEBRIS_COUNT]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          color={CAPTURE_COLOR}
          transparent
          opacity={0.18}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
    </>
  )
}

function CmgAssembly({ progressRef }: { progressRef: ProgressRef }) {
  const outerRef = useRef<THREE.Group>(null)
  const innerRef = useRef<THREE.Group>(null)
  const outerAngle = useRef(0)
  const innerAngle = useRef(0)
  const outerRate = useRef(0.25)
  const innerRate = useRef(0.2)
  const smoothProgress = useDampedProgress()

  useFrame((_, delta) => {
    const dt = Math.min(delta, MAX_DELTA)
    const p = smoothProgress(progressRef.current ?? 0, dt)
    const stabilize = smoothstep(range01(p, 0.72, 0.9))
    // Rates are integrated into an angle instead of multiplying elapsed time.
    // The old form jumped the wheel by (elapsed * rate change) every time the
    // scroll moved, which read as a stutter rather than a spin-up.
    outerRate.current = damp(outerRate.current, 0.25 + stabilize * 3, 3.4, dt)
    innerRate.current = damp(innerRate.current, 0.2 + stabilize * 3.6, 3.1, dt)
    outerAngle.current = (outerAngle.current + outerRate.current * dt) % (Math.PI * 2)
    innerAngle.current = (innerAngle.current - innerRate.current * dt) % (Math.PI * 2)
    if (outerRef.current) outerRef.current.rotation.x = outerAngle.current
    if (innerRef.current) innerRef.current.rotation.y = innerAngle.current
  })
  return (
    <group position={[-0.38, 0, 0]}>
      <group ref={outerRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.19, 0.026, 8, 36]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.18} />
        </mesh>
      </group>
      <group ref={innerRef}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.13, 0.02, 8, 32]} />
          <meshStandardMaterial color={ORBIT_COLOR} emissive="#312e81" emissiveIntensity={0.8} />
        </mesh>
      </group>
    </group>
  )
}

const CAPTURE_PIECES = 6
const CAPTURE_START = 0.24
const CAPTURE_STAGGER = 0.048
const CAPTURE_WINDOW = 0.17

function captureStart(index: number) {
  return CAPTURE_START + index * CAPTURE_STAGGER
}

/**
 * Debris funnelling into the tunnel mouth.
 *
 * This replaced a single octahedron that shrank in place, which read as one
 * object disappearing rather than as a vehicle collecting a field. Six pieces
 * enter on staggered windows and converge on the chamber, so the capture is
 * legible as a sequence: they queue, they stream in, the chamber lights up.
 *
 * Rendered inside the rig group, so the pieces travel with the vehicle.
 */
function CaptureStream({ progressRef, reduced }: { progressRef: ProgressRef; reduced: boolean }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const scales = useRef<number[]>([])
  const primedRef = useRef(false)
  const targetPos = useMemo(() => new THREE.Vector3(), [])
  const smoothProgress = useDampedProgress()

  useFrame((state, delta) => {
    const dt = Math.min(delta, MAX_DELTA)
    const p = smoothProgress(progressRef.current ?? 0, dt)
    const time = state.clock.elapsedTime
    const primed = primedRef.current

    meshes.current.forEach((mesh, i) => {
      if (!mesh) return
      // Staggered so they arrive one after another instead of all at once.
      const start = captureStart(i)
      const t = range01(p, start, start + CAPTURE_WINDOW)
      // Accelerating rather than linear: a piece loiters in the queue and is
      // then snatched, instead of gliding in at a constant rate.
      const draw = t * t
      // Compaction happens at the mouth, not on the way there.
      const crush = smoothstep(range01(t, 0.5, 1))

      const queueX = 1.08 + i * 0.38
      const lateral = (deterministic(i, 7) - 0.5) * 0.62
      const vertical = (deterministic(i, 11) - 0.5) * 0.54
      // Loose tumble while queued, gone by the time it is under tow.
      const drift = reduced ? 0 : (1 - t) * 0.028

      // Converge on the chamber, flattening the spread as they approach.
      targetPos.set(
        THREE.MathUtils.lerp(queueX, 0.14, draw),
        THREE.MathUtils.lerp(vertical, 0, draw) + Math.sin(time * 0.62 + i * 1.3) * drift,
        THREE.MathUtils.lerp(lateral, 0, draw) + Math.cos(time * 0.47 + i * 1.9) * drift,
      )
      if (!primed) mesh.position.copy(targetPos)
      else dampVector(mesh.position, targetPos, 14, dt)

      // Compacted into a pellet as it enters, rather than simply vanishing.
      const size = 0.1 + deterministic(i, 3) * 0.055
      const targetScale = THREE.MathUtils.lerp(size, 0.018, crush)
      const current = scales.current[i]
      const next = primed && current !== undefined ? damp(current, targetScale, 13, dt) : targetScale
      scales.current[i] = next
      mesh.scale.setScalar(next)

      // Spins up as it is dragged in, then the spin bleeds off under compaction.
      const settle = (1 + 1.5 * draw * (1 - crush)) * (1 - easeInOutCubic(crush) * 0.94)
      mesh.rotation.x += (1.26 + i * 0.18) * settle * dt
      mesh.rotation.y += 0.84 * settle * dt
      mesh.visible = t < 1 || next > 0.025
    })
    primedRef.current = true
  })

  return (
    <group>
      {Array.from({ length: CAPTURE_PIECES }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el
          }}
        >
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
    </group>
  )
}

/** Scroll position where the rail is considered to have fired. */
const EJECT_FIRE_P = 0.585
/** Scrolling back past this re-arms the shot. */
const EJECT_ARM_P = 0.55
/** Underdamped so the hull swings back once and settles instead of snapping. */
const RECOIL_STIFFNESS = 118
const RECOIL_DAMPING = 12
/** Sized so the hull peaks near the 0.12 offset the old hard-coded kick used. */
const RECOIL_IMPULSE = 2.5

/**
 * The discharge gate. Effectively a step, since it opens across well under one
 * percent of the beat, but ramped over a couple of frames so a scroll that
 * parks exactly on the trigger cannot strobe the rail.
 */
function dischargeGate(raw: number) {
  return smoothstep(range01(raw, EJECT_FIRE_P - 0.004, EJECT_FIRE_P + 0.004))
}

function SweepVehicle({ progressRef, reduced }: { progressRef: ProgressRef; reduced: boolean }) {
  const rigRef = useRef<THREE.Group>(null)
  const chamberRef = useRef<THREE.MeshStandardMaterial>(null)
  const railRef = useRef<THREE.MeshStandardMaterial>(null)
  const basePos = useMemo(() => new THREE.Vector3(1.62, 0.92, 0.55), [])
  const targetPos = useMemo(() => new THREE.Vector3(), [])
  const yawRef = useRef(-0.4)
  const chamberGlow = useRef(0.25)
  const recoil = useRef({ offset: 0, velocity: 0, armed: true })
  const primedRef = useRef(false)
  const smoothProgress = useDampedProgress()

  useFrame((state, delta) => {
    const dt = Math.min(delta, MAX_DELTA)
    const raw = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const p = smoothProgress(raw, dt)
    const time = state.clock.elapsedTime
    const primed = primedRef.current
    const enter = smoothstep(range01(p, 0.22, 0.4))
    const compress = Math.sin(range01(p, 0.42, 0.58) * Math.PI)
    const stabilize = smoothstep(range01(p, 0.72, 0.9))

    /*
     * The shot itself is a genuinely instantaneous event, so it is triggered off
     * the raw scroll value and kicks a spring. Reading the recoil straight from
     * progress meant it froze wherever the scroll stopped and snapped back on
     * the way out; an impulse decays on its own clock and always settles.
     */
    const kick = recoil.current
    if (raw < EJECT_ARM_P) kick.armed = true
    else if (kick.armed && raw >= EJECT_FIRE_P) {
      kick.armed = false
      // Only fire if the beat is actually being played, not if the viewer
      // arrived with the scroll already past it.
      if (raw < 0.7 && !reduced) kick.velocity -= RECOIL_IMPULSE
    }
    // Control moment gyros bleed the oscillation off during the stabilize beat.
    // Semi-implicit on the spring term and an exact exponential on the damping
    // term, so the integrator cannot ring at a long clamped step.
    const springDamping = RECOIL_DAMPING + stabilize * 22
    kick.velocity -= RECOIL_STIFFNESS * kick.offset * dt
    kick.velocity *= Math.exp(-springDamping * dt)
    kick.offset += kick.velocity * dt
    if (Math.abs(kick.offset) < 1e-4 && Math.abs(kick.velocity) < 1e-4) {
      kick.offset = 0
      kick.velocity = 0
    }

    // Station keeping before the gyros spin up, dead calm after.
    const idle = reduced ? 0 : 1 - stabilize

    // Starts inside the frame. It used to begin at x=2.3, which put the
    // capture tunnel half outside the viewer for the whole approach.
    targetPos.set(
      THREE.MathUtils.lerp(1.62, 0.75, enter),
      THREE.MathUtils.lerp(0.92, 0.55, enter) + Math.sin(time * 0.55) * 0.012 * idle,
      THREE.MathUtils.lerp(0.55, 0, enter) + Math.sin(time * 0.41 + 2.1) * 0.01 * idle,
    )
    if (!primed) basePos.copy(targetPos)
    else dampVector(basePos, targetPos, 7, dt)

    const yawTarget = THREE.MathUtils.lerp(-0.4, -0.12, enter)
    yawRef.current = primed ? damp(yawRef.current, yawTarget, 7, dt) : yawTarget

    if (rigRef.current) {
      rigRef.current.position.set(
        basePos.x + kick.offset,
        basePos.y,
        basePos.z,
      )
      rigRef.current.rotation.y = yawRef.current + kick.offset * 0.22
      rigRef.current.rotation.z = kick.offset * -0.5 + Math.sin(time * 0.7) * 0.008 * idle
    }

    // Each piece landing adds a step to the chamber glow, so the capture reads
    // as six arrivals rather than one smooth ramp.
    let ingest = 0
    for (let i = 0; i < CAPTURE_PIECES; i++) {
      const landed = captureStart(i) + CAPTURE_WINDOW
      ingest += Math.max(0, 1 - Math.abs(p - landed) / 0.045)
    }
    const flicker = reduced ? 0 : Math.sin(time * 7.3) * 0.1 + Math.sin(time * 3.1) * 0.07
    const chamberTarget = 0.25 + compress * 3.5 + ingest * 0.9 + compress * flicker
    chamberGlow.current = primed ? damp(chamberGlow.current, chamberTarget, 9, dt) : chamberTarget
    if (chamberRef.current) chamberRef.current.emissiveIntensity = chamberGlow.current

    if (railRef.current) {
      // Charge ramps on the damped scroll value; the discharge is deliberately
      // sharp - full brightness on the frame it crosses, then an exponential
      // fall through the rest of the beat.
      const gate = dischargeGate(raw)
      // Charge banks up to the shot and is dumped by it, so the rail goes quiet
      // again for the stabilize beat rather than sitting lit.
      const charge = smoothstep(range01(p, 0.5, EJECT_FIRE_P)) * (1 - gate)
      const stutter = reduced ? 1 : 0.72 + Math.sin(time * 21) * 0.28
      const fireT = range01(raw, EJECT_FIRE_P, 0.72)
      railRef.current.emissiveIntensity =
        0.4 + charge * 2.2 * stutter + gate * Math.exp(-fireT * 7) * 8
    }

    primedRef.current = true
  })

  return (
    <group ref={rigRef} position={[1.62, 0.92, 0.55]} rotation={[0, -0.4, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.38, 0.38, 1.18, 32, 1, true]} />
        <meshPhysicalMaterial
          color="#61728c"
          emissive="#101827"
          emissiveIntensity={0.45}
          metalness={0.84}
          roughness={0.22}
          clearcoat={0.42}
        />
      </mesh>
      <mesh position={[0.59, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.38, 0.045, 10, 40]} />
        <meshStandardMaterial color="#dbe4ee" metalness={0.92} roughness={0.16} />
      </mesh>
      <mesh position={[-0.59, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.38, 0.045, 10, 40]} />
        <meshStandardMaterial color="#dbe4ee" metalness={0.92} roughness={0.16} />
      </mesh>
      <mesh position={[0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.3, 0.3, 0.62, 32, 1, true]} />
        <meshStandardMaterial
          ref={chamberRef}
          color="#172033"
          emissive={CAPTURE_COLOR}
          emissiveIntensity={0.25}
          metalness={0.52}
          roughness={0.28}
          transparent
          opacity={0.82}
        />
      </mesh>
      <CaptureStream progressRef={progressRef} reduced={reduced} />
      <CmgAssembly progressRef={progressRef} />

      <group position={[0.42, -0.18, 0]}>
        {[-0.1, 0.1].map((z) => (
          <mesh key={z} position={[0, 0, z]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.06, 0.78, 0.045]} />
            <meshStandardMaterial
              ref={z < 0 ? railRef : undefined}
              color={RAIL_COLOR}
              emissive={RAIL_COLOR}
              emissiveIntensity={0.4}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
      <mesh position={[-0.18, 0, -0.56]}>
        <boxGeometry args={[0.64, 0.035, 0.58]} />
        <meshPhysicalMaterial color="#1e3a5f" metalness={0.65} roughness={0.3} clearcoat={0.5} />
      </mesh>
      <mesh position={[-0.18, 0, 0.56]}>
        <boxGeometry args={[0.64, 0.035, 0.58]} />
        <meshPhysicalMaterial color="#1e3a5f" metalness={0.65} roughness={0.3} clearcoat={0.5} />
      </mesh>
    </group>
  )
}

/** drei's Line uses LineMaterial, which carries a dash offset uniform. */
type DashableMaterial = THREE.LineBasicMaterial & { dashOffset?: number }

function quadraticPoint(
  out: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  t: number,
) {
  const inv = 1 - t
  const w0 = inv * inv
  const w1 = 2 * inv * t
  const w2 = t * t
  return out.set(
    a.x * w0 + b.x * w1 + c.x * w2,
    a.y * w0 + b.y * w1 + c.y * w2,
    a.z * w0 + b.z * w1 + c.z * w2,
  )
}

function quadraticTangent(
  out: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  t: number,
) {
  const inv = 1 - t
  out.set(
    2 * inv * (b.x - a.x) + 2 * t * (c.x - b.x),
    2 * inv * (b.y - a.y) + 2 * t * (c.y - b.y),
    2 * inv * (b.z - a.z) + 2 * t * (c.z - b.z),
  )
  return out.lengthSq() < 1e-8 ? out.set(1, 0, 0) : out.normalize()
}

function MissionEffects({ progressRef, reduced }: { progressRef: ProgressRef; reduced: boolean }) {
  const interceptMaterial = useRef<DashableMaterial | null>(null)
  const ejectMaterial = useRef<THREE.LineBasicMaterial | null>(null)
  const pelletRef = useRef<THREE.Mesh>(null)
  const pelletMaterial = useRef<THREE.MeshStandardMaterial>(null)
  const flashRef = useRef<THREE.Mesh>(null)
  const flashMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const smoothProgress = useDampedProgress()
  const pelletPoint = useMemo(() => new THREE.Vector3(), [])
  const pelletDir = useMemo(() => new THREE.Vector3(), [])
  const xAxis = useMemo(() => new THREE.Vector3(1, 0, 0), [])

  const intercept = useMemo(
    () => [
      new THREE.Vector3(2.1, 1.1, 0.65),
      new THREE.Vector3(1.55, 0.9, 0.35),
      new THREE.Vector3(1.02, 0.62, 0.06),
    ],
    [],
  )
  const eject = useMemo(
    () => [
      new THREE.Vector3(1.1, 0.37, 0),
      new THREE.Vector3(1.65, 0.18, 0.15),
      new THREE.Vector3(2.55, -0.18, 0.46),
    ],
    [],
  )

  useFrame((state, delta) => {
    const dt = Math.min(delta, MAX_DELTA)
    const raw = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const p = smoothProgress(raw, dt)
    const time = state.clock.elapsedTime
    const scan = smoothstep(range01(p, 0.1, 0.3)) * (1 - smoothstep(range01(p, 0.42, 0.5)))

    if (interceptMaterial.current) {
      interceptMaterial.current.opacity = scan * 0.75
      // Crawling dashes read as an active track rather than a static annotation.
      if (typeof interceptMaterial.current.dashOffset === 'number' && !reduced) {
        interceptMaterial.current.dashOffset = -(time * 0.09) % 0.105
      }
    }

    /*
     * Railgun impulse. Attack is one frame by design - the rest of the beat is
     * the pellet leaving and the trail cooling, so the event stays sharp while
     * everything around it settles.
     */
    const fired = dischargeGate(raw)
    const fireT = range01(raw, EJECT_FIRE_P, 0.72)
    const muzzle = fired * Math.exp(-fireT * 16)
    const trail = fired * Math.exp(-fireT * 3.4)
    // Leaves fast, then only perspective slows it.
    const travel = 1 - Math.pow(1 - fireT, 2.2)
    const exit = 1 - smoothstep(range01(fireT, 0.82, 1))
    const energy = reduced ? 0 : 1

    if (ejectMaterial.current) {
      ejectMaterial.current.opacity = fired * (0.22 + 0.63 * trail) * exit
    }
    if (pelletRef.current) {
      pelletRef.current.visible = fired > 0.01 && exit > 0.01
      if (pelletRef.current.visible) {
        pelletRef.current.position.copy(quadraticPoint(pelletPoint, eject[0], eject[1], eject[2], travel))
        pelletRef.current.quaternion.setFromUnitVectors(
          xAxis,
          quadraticTangent(pelletDir, eject[0], eject[1], eject[2], travel),
        )
        // Stretched into a streak at the muzzle, rounding out as it coasts.
        const radius = (0.042 + easeOutCubic(fireT) * 0.02) * exit
        pelletRef.current.scale.set(radius * (1 + 6 * muzzle * energy), radius, radius)
      }
      if (pelletMaterial.current) {
        pelletMaterial.current.emissiveIntensity = 3 + muzzle * 9
      }
    }
    if (flashRef.current) {
      flashRef.current.visible = muzzle > 0.02 && energy > 0
      if (flashRef.current.visible) flashRef.current.scale.setScalar(0.05 + muzzle * 0.3)
    }
    if (flashMaterial.current) flashMaterial.current.opacity = muzzle * 0.85 * energy
  })

  return (
    <>
      <Line
        points={intercept}
        color={CAPTURE_COLOR}
        transparent
        opacity={0}
        lineWidth={1.5}
        dashed
        dashSize={0.06}
        gapSize={0.045}
        onUpdate={(line: THREE.Line) => {
          interceptMaterial.current = line.material as DashableMaterial
        }}
      />
      <Line
        points={eject}
        color={RAIL_COLOR}
        transparent
        opacity={0}
        lineWidth={2}
        onUpdate={(line: THREE.Line) => {
          ejectMaterial.current = line.material as THREE.LineBasicMaterial
        }}
      />
      <mesh ref={pelletRef} visible={false}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial
          ref={pelletMaterial}
          color="#fff7d6"
          emissive={RAIL_COLOR}
          emissiveIntensity={4}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={flashRef} position={eject[0]} visible={false}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial
          ref={flashMaterial}
          color="#fff3c4"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </>
  )
}

function DebrisScene({ progressRef, reduced }: { progressRef: ProgressRef; reduced: boolean }) {
  return (
    <>
      <color attach="background" args={['#030610']} />
      <fog attach="fog" args={['#030610', 7, 12]} />
      <ambientLight intensity={0.24} />
      <directionalLight position={[5, 6, 4]} intensity={1.65} color="#f8fafc" />
      <directionalLight position={[-4, 2, 3]} intensity={0.65} color={ORBIT_COLOR} />
      <pointLight position={[1, 1.2, 2]} intensity={0.8} color={CAPTURE_COLOR} distance={4} />
      <CameraRig progressRef={progressRef} reduced={reduced} />
      <Starfield />
      <Earth />
      <OrbitShells />
      <DebrisField progressRef={progressRef} reduced={reduced} />
      <SweepVehicle progressRef={progressRef} reduced={reduced} />
      <MissionEffects progressRef={progressRef} reduced={reduced} />
    </>
  )
}

function getTelemetry(progress: number) {
  const p = THREE.MathUtils.clamp(progress, 0, 1)
  let phase = 'Orbital survey'
  let detail = 'Cataloging LEO debris'
  let mode = 'SCAN'
  if (p >= 0.88) {
    phase = 'Mission reset'
    detail = 'Next target acquired'
    mode = 'READY'
  } else if (p >= 0.74) {
    phase = 'CMG stabilize'
    detail = 'Recoil cancellation'
    mode = 'ATTITUDE'
  } else if (p >= 0.58) {
    phase = 'Railgun eject'
    detail = 'Pellet disposal burn'
    mode = 'FIRE'
  } else if (p >= 0.42) {
    phase = 'Encapsulate'
    detail = 'Conductive compression'
    mode = 'PROCESS'
  } else if (p >= 0.28) {
    phase = 'Capture'
    detail = 'Tunnel intercept'
    mode = 'INGEST'
  } else if (p >= 0.1) {
    phase = 'Track'
    detail = 'Relative navigation'
    mode = 'TRACK'
  }
  return {
    phase,
    detail,
    mode,
    tracked: String(Math.round(847 - range01(p, 0.28, 0.88) * 612)),
    cleared: `${Math.round(range01(p, 0.42, 1) * 72)}%`,
  }
}

export interface SpaceDebrisOrbitProps {
  scrollProgress?: number
  progress?: MotionValue<number>
  active?: boolean
  className?: string
  showConferenceBadge?: boolean
}

export function SpaceDebrisOrbit({
  scrollProgress = 0,
  progress,
  active = true,
  className = '',
  showConferenceBadge = true,
}: SpaceDebrisOrbitProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isVisible = useIntersectionPause(containerRef)
  const progressRef = useMotionProgressRef(progress, scrollProgress)
  const fallbackProgress = useMotionValue(scrollProgress)
  const source = progress ?? fallbackProgress
  const liveProgress = useThrottledMotionValue(source, 100)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!progress) fallbackProgress.set(scrollProgress)
  }, [progress, scrollProgress, fallbackProgress])
  useEffect(() => {
    progressRef.current = progress?.get() ?? scrollProgress
  }, [progress, scrollProgress, progressRef])
  useMotionValueEvent(source, 'change', (value) => {
    progressRef.current = value
  })

  const telemetry = getTelemetry(liveProgress)

  return (
    <div ref={containerRef}>
      <ResearchViewerFrame
        className={`${className} research-viewer--debris`}
        progressPercent={Math.round(liveProgress * 100)}
        badge={
          showConferenceBadge ? (
            <ConferenceBadgeOverlay conference="AAS" number="248" location="Pasadena, California" />
          ) : undefined
        }
        telemetry={
          <ViewerTelemetry
            label="SWEEP mission"
            rows={[
              { key: 'Phase', value: telemetry.phase },
              { key: 'Tracked', value: telemetry.tracked },
              { key: 'Altitude', value: '550 km' },
              { key: 'Cleared', value: telemetry.cleared },
              { key: 'Mode', value: telemetry.mode },
            ]}
          />
        }
        legend={
          <div className="research-viewer__legend">
            <span className="research-viewer__legend-item research-viewer__legend-item--capture">Target lock</span>
            <span className="research-viewer__legend-item research-viewer__legend-item--debris">Debris field</span>
            <span className="research-viewer__legend-item research-viewer__legend-item--rail">Rail ejection</span>
          </div>
        }
      >
        <Canvas
          camera={{ position: [4.6, 2.2, 5.4], fov: 40, near: 0.1, far: 30 }}
          dpr={[1, 1.5]}
          gl={{ alpha: true, antialias: false, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
          frameloop={isVisible && active ? 'always' : 'demand'}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <DebrisScene progressRef={progressRef} reduced={reduced} />
          </Suspense>
        </Canvas>
        <div className="viewer-phase" aria-hidden="true">
          <span className="viewer-phase__index">{String(Math.min(5, Math.floor(liveProgress * 6)) + 1).padStart(2, '0')}</span>
          <span className="viewer-phase__copy"><strong>{telemetry.phase}</strong><small>{telemetry.detail}</small></span>
        </div>
      </ResearchViewerFrame>
    </div>
  )
}
