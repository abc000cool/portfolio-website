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
import { ResearchViewerFrame, ViewerTelemetry } from '../research/ResearchViewerFrame'

const PHOTON_COUNT = 84
const REFLECTED_COUNT = 42
const STAR_COUNT = 260

const SUN_CORE = '#fde68a'
const PHOTON_COLOR = '#fbbf24'
const RING_COLOR = '#818cf8'
const KEPLER_COLOR = '#e2e8f0'
const CONE_COLOR = '#fb7185'
const ENVELOPE_COLOR = '#86efac'
const IDEAL_COLOR = '#94a3b8'
const SAIL_COLOR = '#cbd5e1'

/** Showcase orbit: ρ = 0.95 AU, z = 0.15 AU → β ≈ 0.16, σ ≈ 9.7 g/m². */
const KEPLER_RADIUS = 2.2
const DISPLACED_RADIUS = 2.0
const DISPLACED_HEIGHT = 0.72
/** Hard thrust-cone ceiling of the six-coefficient optical model. */
const CONE_LIMIT_DEG = 55.5

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
const CAMERA_SNAP_DISTANCE_SQ = 9
/** A sail this size slews to a new attitude, it does not click into it. */
const SAIL_ATTITUDE_LAMBDA = 7

type ProgressRef = React.RefObject<number | null>

function range01(value: number, start: number, end: number): number {
  if (end <= start) return value >= end ? 1 : 0
  return THREE.MathUtils.clamp((value - start) / (end - start), 0, 1)
}

function pulseWindow(progress: number, start: number, end: number): number {
  return Math.sin(range01(progress, start, end) * Math.PI)
}

/** Deterministic pseudo-random in [0, 1) from an integer seed. */
function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Frame-rate independent exponential approach. Stable under variable delta. */
function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt))
}

function dampVector(
  current: THREE.Vector3,
  target: THREE.Vector3,
  lambda: number,
  dt: number,
): void {
  current.lerp(target, 1 - Math.exp(-lambda * dt))
}

function easeOutCubic(t: number): number {
  const inv = 1 - t
  return 1 - inv * inv * inv
}

/**
 * A damped copy of the scroll value.
 *
 * Reading scroll progress raw maps every bit of wheel and trackpad jitter
 * straight onto the animation. Each rig keeps its own copy rather than sharing
 * mutable module state, and because they all integrate the same input with the
 * same constants on the same frame they stay in lockstep - which matters here,
 * since four rigs derive the craft's position independently.
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

interface CraftState {
  ringRadius: number
  ringHeight: number
  theta: number
  position: THREE.Vector3
  sunDir: THREE.Vector3
  /** Sail pitch off the Sun line, radians. */
  pitch: number
  thrustDir: THREE.Vector3
  clamped: boolean
}

/** Scroll-choreography state shared by every rig component. */
function computeCraftState(p: number, time: number, out: CraftState): CraftState {
  const liftF = smoothstep(range01(p, 0.36, 0.58))
  const pitchF = smoothstep(range01(p, 0.26, 0.38))
  const coneSweep = pulseWindow(p, 0.58, 0.74)

  out.ringRadius = THREE.MathUtils.lerp(KEPLER_RADIUS, DISPLACED_RADIUS, liftF)
  out.ringHeight = DISPLACED_HEIGHT * liftF
  out.theta = time * 0.24
  out.position.set(
    Math.cos(out.theta) * out.ringRadius,
    out.ringHeight,
    Math.sin(out.theta) * out.ringRadius,
  )
  out.sunDir.copy(out.position).normalize()

  const nominalPitch = THREE.MathUtils.degToRad(35.3) * pitchF
  const rawPitch = nominalPitch + THREE.MathUtils.degToRad(34) * coneSweep
  const limit = THREE.MathUtils.degToRad(CONE_LIMIT_DEG)
  out.clamped = rawPitch > limit
  out.pitch = Math.min(rawPitch, limit)

  // Tilt the thrust direction from the Sun line toward +Y (out of plane).
  const axis = tmpAxis.crossVectors(out.sunDir, UP)
  if (axis.lengthSq() < 1e-6) axis.set(0, 0, 1)
  axis.normalize()
  out.thrustDir.copy(out.sunDir).applyAxisAngle(axis, out.pitch).normalize()
  return out
}

const UP = new THREE.Vector3(0, 1, 0)
const tmpAxis = new THREE.Vector3()

function makeCraftState(): CraftState {
  return {
    ringRadius: KEPLER_RADIUS,
    ringHeight: 0,
    theta: 0,
    position: new THREE.Vector3(KEPLER_RADIUS, 0, 0),
    sunDir: new THREE.Vector3(1, 0, 0),
    pitch: 0,
    thrustDir: new THREE.Vector3(1, 0, 0),
    clamped: false,
  }
}

function CameraRig({ progressRef }: { progressRef: ProgressRef }) {
  const { camera } = useThree()
  const positionRef = useRef(new THREE.Vector3())
  const targetRef = useRef(new THREE.Vector3())
  const chaseRef = useRef(new THREE.Vector3())
  const aimRef = useRef(new THREE.Vector3())
  const primedRef = useRef(false)
  const craft = useMemo(() => makeCraftState(), [])
  const smoothProgress = useDampedProgress()

  useFrame((state, delta) => {
    const dt = Math.min(delta, MAX_DELTA)
    const p = smoothProgress(progressRef.current ?? 0, dt)
    computeCraftState(p, state.clock.elapsedTime, craft)
    const lift = smoothstep(range01(p, 0.36, 0.58))
    const envelope = smoothstep(range01(p, 0.74, 0.92))
    // Chase the craft while the thrust-cone ceiling is on stage.
    const track =
      smoothstep(range01(p, 0.56, 0.66)) * (1 - smoothstep(range01(p, 0.76, 0.88)))
    const position = positionRef.current
    const target = targetRef.current
    const aim = aimRef.current

    position.set(
      THREE.MathUtils.lerp(3.0, 2.7, lift) + envelope * 0.9,
      THREE.MathUtils.lerp(0.62, 1.5, lift) + envelope * 1.05,
      THREE.MathUtils.lerp(4.5, 4.6, lift) + envelope * 1.25,
    )
    target.set(
      THREE.MathUtils.lerp(0.45, 0.2, lift) - envelope * 0.2,
      THREE.MathUtils.lerp(0.1, 0.55, lift) + envelope * 0.25,
      0,
    )

    if (track > 0.001) {
      chaseRef.current.set(
        craft.position.x * 2.1,
        craft.position.y + 0.95,
        craft.position.z * 2.1,
      )
      position.lerp(chaseRef.current, track * 0.85)
      target.lerp(craft.position, track * 0.9)
    }

    // Exponential approach instead of a fixed per-frame lerp: the old form ran
    // twice as fast at 120fps as at 60 and never quite arrived.
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

function makeGlowTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(255, 244, 214, 1)')
    gradient.addColorStop(0.35, 'rgba(253, 224, 138, 0.55)')
    gradient.addColorStop(0.7, 'rgba(245, 158, 11, 0.16)')
    gradient.addColorStop(1, 'rgba(245, 158, 11, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function Sun() {
  const glowTexture = useMemo(() => makeGlowTexture(), [])
  const coreRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const flicker = 1 + Math.sin(state.clock.elapsedTime * 2.1) * 0.03
    if (coreRef.current) coreRef.current.scale.setScalar(flicker)
  })

  return (
    <group>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.32, 40, 40]} />
        <meshBasicMaterial color={SUN_CORE} toneMapped={false} />
      </mesh>
      <sprite scale={[1.9, 1.9, 1]}>
        <spriteMaterial
          map={glowTexture}
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <sprite scale={[3.6, 3.6, 1]}>
        <spriteMaterial
          map={glowTexture}
          transparent
          opacity={0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <pointLight color="#fff3d6" intensity={2.8} distance={16} decay={1.1} />
    </group>
  )
}

function Starfield() {
  const positions = useMemo(() => {
    const out = new Float32Array(STAR_COUNT * 3)
    for (let i = 0; i < STAR_COUNT; i++) {
      const radius = 8.5 + hash01(i * 3) * 3.5
      const phi = hash01(i * 3 + 1) * Math.PI * 2
      const cosTheta = hash01(i * 3 + 2) * 2 - 1
      const sinTheta = Math.sqrt(1 - cosTheta * cosTheta)
      out[i * 3] = radius * sinTheta * Math.cos(phi)
      out[i * 3 + 1] = radius * cosTheta
      out[i * 3 + 2] = radius * sinTheta * Math.sin(phi)
    }
    return out
  }, [])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#e2e8f0"
        size={0.022}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </points>
  )
}

const UNIT_CIRCLE_POINTS = (() => {
  const points: [number, number, number][] = []
  for (let i = 0; i <= 96; i++) {
    const angle = (i / 96) * Math.PI * 2
    points.push([Math.cos(angle), 0, Math.sin(angle)])
  }
  return points
})()

function EclipticPlane() {
  return (
    <group>
      {[1.15, 1.7, 2.2, 2.7].map((radius) => (
        <group key={radius} scale={[radius, 1, radius]}>
          <Line
            points={UNIT_CIRCLE_POINTS}
            color="#334155"
            transparent
            opacity={radius === 2.2 ? 0.24 : 0.13}
            lineWidth={1}
          />
        </group>
      ))}
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index / 8) * Math.PI * 2
        return (
          <Line
            key={index}
            points={[
              [Math.cos(angle) * 0.55, 0, Math.sin(angle) * 0.55],
              [Math.cos(angle) * 2.85, 0, Math.sin(angle) * 2.85],
            ]}
            color="#1e293b"
            transparent
            opacity={0.35}
            lineWidth={1}
          />
        )
      })}
    </group>
  )
}

/** The classical orbit - stays behind as a ghost once the ring lifts. */
function KeplerRing({ progressRef }: { progressRef: ProgressRef }) {
  const materialRef = useRef<THREE.LineBasicMaterial | null>(null)
  const smoothProgress = useDampedProgress()

  useFrame((_, delta) => {
    const p = smoothProgress(progressRef.current ?? 0, Math.min(delta, MAX_DELTA))
    const reveal = smoothstep(range01(p, 0.02, 0.1))
    const ghost = smoothstep(range01(p, 0.36, 0.58))
    if (materialRef.current) {
      materialRef.current.opacity = reveal * THREE.MathUtils.lerp(0.75, 0.18, ghost)
    }
  })

  return (
    <group scale={[KEPLER_RADIUS, 1, KEPLER_RADIUS]}>
      <Line
        points={UNIT_CIRCLE_POINTS}
        color={KEPLER_COLOR}
        transparent
        opacity={0}
        lineWidth={1.4}
        onUpdate={(line: THREE.Line) => {
          materialRef.current = line.material as THREE.LineBasicMaterial
        }}
      />
    </group>
  )
}

/** The displaced NKO ring rising bodily above the ecliptic. */
function DisplacedRing({ progressRef }: { progressRef: ProgressRef }) {
  const groupRef = useRef<THREE.Group>(null)
  const ringMaterial = useRef<THREE.LineBasicMaterial | null>(null)
  const axisMaterial = useRef<THREE.LineBasicMaterial | null>(null)
  const axisGroup = useRef<THREE.Group>(null)
  const centerRef = useRef<THREE.Mesh>(null)
  const smoothProgress = useDampedProgress()

  useFrame((_, delta) => {
    const p = smoothProgress(progressRef.current ?? 0, Math.min(delta, MAX_DELTA))
    const lift = smoothstep(range01(p, 0.36, 0.58))
    const radius = THREE.MathUtils.lerp(KEPLER_RADIUS, DISPLACED_RADIUS, lift)

    if (groupRef.current) {
      groupRef.current.visible = lift > 0.01
      groupRef.current.scale.set(radius, 1, radius)
      groupRef.current.position.y = DISPLACED_HEIGHT * lift
    }
    if (ringMaterial.current) ringMaterial.current.opacity = lift * 0.9
    if (axisGroup.current) {
      axisGroup.current.visible = lift > 0.02
      axisGroup.current.scale.y = lift
    }
    if (axisMaterial.current) axisMaterial.current.opacity = lift * 0.5
    if (centerRef.current) {
      centerRef.current.visible = lift > 0.02
      centerRef.current.position.y = DISPLACED_HEIGHT * lift
      const material = centerRef.current.material as THREE.MeshBasicMaterial
      material.opacity = lift * 0.85
    }
  })

  return (
    <>
      <group ref={groupRef} visible={false}>
        <Line
          points={UNIT_CIRCLE_POINTS}
          color={RING_COLOR}
          transparent
          opacity={0}
          lineWidth={2}
          onUpdate={(line: THREE.Line) => {
            ringMaterial.current = line.material as THREE.LineBasicMaterial
          }}
        />
      </group>
      <group ref={axisGroup} visible={false}>
        <Line
          points={[
            [0, 0.05, 0],
            [0, DISPLACED_HEIGHT, 0],
          ]}
          color={RING_COLOR}
          transparent
          opacity={0}
          lineWidth={1.2}
          dashed
          dashSize={0.045}
          gapSize={0.04}
          onUpdate={(line: THREE.Line) => {
            axisMaterial.current = line.material as THREE.LineBasicMaterial
          }}
        />
      </group>
      <mesh ref={centerRef} visible={false}>
        <sphereGeometry args={[0.022, 12, 12]} />
        <meshBasicMaterial color={RING_COLOR} transparent opacity={0} toneMapped={false} />
      </mesh>
    </>
  )
}

/**
 * The sail rests at roughly half span rather than at zero. Scaling from ~0 made
 * the opening frame of this scene a sun and two faint rings with no spacecraft
 * anywhere, which read as a failed render rather than as "not deployed yet".
 */
const REST_SPAN = 0.46
/** Membrane span while stowed, as a fraction of the boom span. */
const REST_PETAL = 0.45
/** Quadrant-to-quadrant delay through the unfurl. */
const PETAL_LAG = 0.06
/** Booms are fully extended by this point in the deployment, ahead of the film. */
const BOOM_LEAD = 0.72
const SAIL_SCALE = 0.82
const HALF_PI = Math.PI / 2
const QUARTER_PI = Math.PI / 4

/** Square sail: four petals on crossed booms, bus at the hub. */
function SailCraft({ progressRef, reduced }: { progressRef: ProgressRef; reduced: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const sailRef = useRef<THREE.Group>(null)
  const petalRefs = useRef<THREE.Mesh[]>([])
  const boomRefs = useRef<THREE.Mesh[]>([])
  const craft = useMemo(() => makeCraftState(), [])
  const lookTarget = useMemo(() => new THREE.Vector3(), [])
  const attitude = useMemo(() => new THREE.Object3D(), [])
  const spanRef = useRef(REST_SPAN)
  const primedRef = useRef(false)
  const smoothProgress = useDampedProgress()

  const petalGeometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0.035, 0.035)
    shape.lineTo(0.56, 0.035)
    shape.lineTo(0.035, 0.56)
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, MAX_DELTA)
    const p = smoothProgress(progressRef.current ?? 0, dt)
    const time = state.clock.elapsedTime
    computeCraftState(p, time, craft)
    const primed = primedRef.current

    // Second stage of damping on top of the smoothed scroll value. The deploy
    // window is the narrowest beat in the scene, so it is the one that shows
    // scroll jitter first.
    const targetSpan = REST_SPAN + (1 - REST_SPAN) * smoothstep(range01(p, 0.12, 0.26))
    spanRef.current = primed ? damp(spanRef.current, targetSpan, 9, dt) : targetSpan
    const span = spanRef.current
    const deploy = THREE.MathUtils.clamp((span - REST_SPAN) / (1 - REST_SPAN), 0, 1)

    if (groupRef.current) {
      groupRef.current.position.copy(craft.position)
    }
    if (sailRef.current) {
      lookTarget.copy(craft.position).add(craft.thrustDir)
      attitude.position.copy(craft.position)
      attitude.lookAt(lookTarget)
      // Slew rather than snap. The parent group carries no rotation, so the
      // world-space attitude is also the local one.
      if (primed) {
        sailRef.current.quaternion.slerp(attitude.quaternion, 1 - Math.exp(-SAIL_ATTITUDE_LAMBDA * dt))
      } else {
        sailRef.current.quaternion.copy(attitude.quaternion)
      }
      // Span now lives on the booms and petals, so the deployment is an unfurl
      // rather than the whole assembly scaling up as one block.
      sailRef.current.scale.setScalar(SAIL_SCALE)
    }

    // Masts extend first and the film follows them out.
    const boomSpan = REST_SPAN + (1 - REST_SPAN) * easeOutCubic(Math.min(1, deploy / BOOM_LEAD))
    for (let index = 0; index < boomRefs.current.length; index++) {
      const boom = boomRefs.current[index]
      if (!boom) continue
      boom.scale.set(boomSpan, 1, 1)
    }

    // Slack membrane while it is being pulled out, dead flat once taut.
    const slack = reduced ? 0 : deploy * (1 - deploy) * 4
    for (let index = 0; index < petalRefs.current.length; index++) {
      const petal = petalRefs.current[index]
      if (!petal) continue
      const quadrant = THREE.MathUtils.clamp(
        (deploy - index * PETAL_LAG) / (1 - 3 * PETAL_LAG),
        0,
        1,
      )
      // Radial edge runs out ahead of the lateral one, so each quadrant sweeps
      // open along its boom instead of inflating from the hub.
      const radial = REST_PETAL + (1 - REST_PETAL) * easeOutCubic(quadrant)
      const lateral = REST_PETAL + (1 - REST_PETAL) * quadrant * quadrant
      petal.scale.set(span * radial, span * lateral, 1)
      petal.rotation.z =
        index * HALF_PI + QUARTER_PI + Math.sin(time * 6.4 + index * 1.7) * 0.03 * slack
      petal.position.z = Math.sin(time * 4.8 + index * 2.3) * 0.012 * slack
    }

    primedRef.current = true
  })

  return (
    <group ref={groupRef}>
      <group ref={sailRef}>
        {Array.from({ length: 4 }, (_, index) => (
          <mesh
            key={index}
            ref={(mesh) => {
              if (mesh) petalRefs.current[index] = mesh
            }}
            geometry={petalGeometry}
            rotation={[0, 0, (index * Math.PI) / 2 + Math.PI / 4]}
          >
            <meshPhysicalMaterial
              color={SAIL_COLOR}
              metalness={0.55}
              roughness={0.3}
              clearcoat={0.4}
              side={THREE.DoubleSide}
              emissive="#475569"
              emissiveIntensity={0.55}
            />
          </mesh>
        ))}
        {[0, Math.PI / 2].map((angle, index) => (
          <mesh
            key={angle}
            ref={(mesh) => {
              if (mesh) boomRefs.current[index] = mesh
            }}
            rotation={[0, 0, angle + Math.PI / 4]}
          >
            <boxGeometry args={[1.18, 0.012, 0.012]} />
            <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.3} />
          </mesh>
        ))}
      </group>
      <mesh>
        <boxGeometry args={[0.05, 0.05, 0.065]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.02, 10, 10]} />
        <meshBasicMaterial color="#e2e8f0" toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Sunlight momentum: incident stream from the Sun, reflected stream off the sail. */
function PhotonStream({ progressRef }: { progressRef: ProgressRef }) {
  const incidentRef = useRef<THREE.InstancedMesh>(null)
  const reflectedRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const craft = useMemo(() => makeCraftState(), [])
  const xAxis = useMemo(() => new THREE.Vector3(1, 0, 0), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  const perpA = useMemo(() => new THREE.Vector3(), [])
  const perpB = useMemo(() => new THREE.Vector3(), [])
  const start = useMemo(() => new THREE.Vector3(), [])
  const reflected = useMemo(() => new THREE.Vector3(), [])
  const smoothProgress = useDampedProgress()

  useFrame((state, delta) => {
    const incident = incidentRef.current
    const bounce = reflectedRef.current
    if (!incident || !bounce) return

    const dt = Math.min(delta, MAX_DELTA)
    const p = smoothProgress(progressRef.current ?? 0, dt)
    const time = state.clock.elapsedTime
    computeCraftState(p, time, craft)
    const deploy = smoothstep(range01(p, 0.14, 0.28))
    const fade = 1 - 0.55 * smoothstep(range01(p, 0.78, 0.92))
    // The reflected stream used to switch on at 40% deployed, which put it on
    // screen at 16% opacity in a single frame.
    const bounceReveal = smoothstep(range01(deploy, 0.38, 0.62))

    incident.visible = deploy > 0.02
    bounce.visible = bounceReveal > 0.01

    // Incident photons: Sun surface → sail, riding the outward Sun line.
    start.copy(craft.sunDir).multiplyScalar(0.36)
    dir.copy(craft.position).sub(start)
    const travel = dir.length()
    dir.normalize()
    perpA.set(-dir.z, 0, dir.x).normalize()
    perpB.crossVectors(dir, perpA)

    for (let i = 0; i < PHOTON_COUNT; i++) {
      const cycle = (time * 0.34 + hash01(i * 7)) % 1
      const spreadA = (hash01(i * 7 + 1) - 0.5) * 0.34
      const spreadB = (hash01(i * 7 + 2) - 0.5) * 0.34
      const focus = 1 - cycle * 0.7
      dummy.position
        .copy(start)
        .addScaledVector(dir, cycle * travel)
        .addScaledVector(perpA, spreadA * focus)
        .addScaledVector(perpB, spreadB * focus)
      dummy.quaternion.setFromUnitVectors(xAxis, dir)
      const pulse = Math.sin(cycle * Math.PI)
      // Each photon loops back to the Sun when its cycle wraps. Without this
      // envelope it teleported at full size once per lap; now it is already
      // scaled to nothing at both ends of the run.
      const wrap = Math.min(1, cycle * 7) * Math.min(1, (1 - cycle) * 5)
      dummy.scale.set((0.09 + pulse * 0.05) * wrap, 0.008 * wrap, 0.008 * wrap)
      dummy.updateMatrix()
      incident.setMatrixAt(i, dummy.matrix)
    }
    incident.instanceMatrix.needsUpdate = true
    ;(incident.material as THREE.MeshBasicMaterial).opacity = deploy * 0.75 * fade

    // Reflected photons carry momentum away along the specular direction.
    reflected
      .copy(dir)
      .addScaledVector(craft.thrustDir, -2 * dir.dot(craft.thrustDir))
      .normalize()
    for (let i = 0; i < REFLECTED_COUNT; i++) {
      const cycle = (time * 0.4 + hash01(i * 13)) % 1
      const spreadA = (hash01(i * 13 + 1) - 0.5) * 0.22
      const spreadB = (hash01(i * 13 + 2) - 0.5) * 0.22
      const travelOut = 0.06 + cycle * 1.15
      dummy.position.set(
        craft.position.x + reflected.x * travelOut + spreadB * cycle,
        craft.position.y + reflected.y * travelOut + spreadA * cycle,
        craft.position.z + reflected.z * travelOut,
      )
      dummy.quaternion.setFromUnitVectors(xAxis, reflected)
      const wrap = Math.min(1, cycle * 6) * Math.min(1, (1 - cycle) * 3.5)
      dummy.scale.set(0.07 * wrap, 0.006 * wrap, 0.006 * wrap)
      dummy.updateMatrix()
      bounce.setMatrixAt(i, dummy.matrix)
    }
    bounce.instanceMatrix.needsUpdate = true
    ;(bounce.material as THREE.MeshBasicMaterial).opacity = deploy * 0.4 * fade * bounceReveal
  })

  return (
    <>
      <instancedMesh ref={incidentRef} args={[undefined, undefined, PHOTON_COUNT]} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color={PHOTON_COLOR}
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
      <instancedMesh
        ref={reflectedRef}
        args={[undefined, undefined, REFLECTED_COUNT]}
        visible={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color="#fef3c7"
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </>
  )
}

/** Hoisted so the clamp indicator never parses a colour string inside useFrame. */
const CLAMPED_COLOR = new THREE.Color(CONE_COLOR)
const NOMINAL_COLOR = new THREE.Color(ENVELOPE_COLOR)

/** Thrust vector vs the Sun line, and the 55.5° optical cone ceiling. */
function ThrustCone({ progressRef, reduced }: { progressRef: ProgressRef; reduced: boolean }) {
  const thrustGroup = useRef<THREE.Group>(null)
  const thrustMaterial = useRef<THREE.LineBasicMaterial | null>(null)
  const thrustTip = useRef<THREE.Mesh>(null)
  const sunLineMaterial = useRef<THREE.LineBasicMaterial | null>(null)
  const sunLineGroup = useRef<THREE.Group>(null)
  const coneGroup = useRef<THREE.Group>(null)
  const coneMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const rimMaterial = useRef<THREE.LineBasicMaterial | null>(null)
  const craft = useMemo(() => makeCraftState(), [])
  const downAxis = useMemo(() => new THREE.Vector3(0, -1, 0), [])
  const yAxis = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const indicator = useMemo(() => new THREE.Color(ENVELOPE_COLOR), [])
  const smoothProgress = useDampedProgress()

  const coneGeometry = useMemo(() => {
    const height = 0.78
    const radius = Math.tan(THREE.MathUtils.degToRad(CONE_LIMIT_DEG)) * height
    const geometry = new THREE.ConeGeometry(radius, height, 48, 1, true)
    geometry.translate(0, -height / 2, 0)
    return geometry
  }, [])

  const rimPoints = useMemo(() => {
    const height = 0.78
    const radius = Math.tan(THREE.MathUtils.degToRad(CONE_LIMIT_DEG)) * height
    return UNIT_CIRCLE_POINTS.map(
      ([x, , z]) => [x * radius, -height, z * radius] as [number, number, number],
    )
  }, [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, MAX_DELTA)
    const p = smoothProgress(progressRef.current ?? 0, dt)
    const time = state.clock.elapsedTime
    computeCraftState(p, time, craft)

    const pitchReveal = smoothstep(range01(p, 0.27, 0.36))
    const coneReveal = smoothstep(range01(p, 0.56, 0.64)) - smoothstep(range01(p, 0.8, 0.9))
    const clampFlash = craft.clamped ? (reduced ? 0.5 : 0.5 + Math.sin(time * 14) * 0.5) : 0
    // Crossfade rather than a hard swap, so a pitch sitting on the ceiling
    // cannot strobe the indicator between two colours frame to frame.
    indicator.lerp(craft.clamped ? CLAMPED_COLOR : NOMINAL_COLOR, 1 - Math.exp(-9 * dt))

    if (thrustGroup.current) {
      thrustGroup.current.visible = pitchReveal > 0.02
      thrustGroup.current.position.copy(craft.position)
      thrustGroup.current.quaternion.setFromUnitVectors(yAxis, craft.thrustDir)
    }
    if (thrustMaterial.current) {
      thrustMaterial.current.opacity = pitchReveal * 0.95
      thrustMaterial.current.color.copy(indicator)
    }
    if (thrustTip.current) {
      const material = thrustTip.current.material as THREE.MeshBasicMaterial
      material.opacity = pitchReveal
      material.color.copy(indicator)
    }
    if (sunLineGroup.current) {
      sunLineGroup.current.visible = pitchReveal > 0.02
      sunLineGroup.current.position.copy(craft.position)
      sunLineGroup.current.quaternion.setFromUnitVectors(yAxis, craft.sunDir)
    }
    if (sunLineMaterial.current) sunLineMaterial.current.opacity = pitchReveal * 0.45
    if (coneGroup.current) {
      coneGroup.current.visible = coneReveal > 0.02
      coneGroup.current.position.copy(craft.position)
      coneGroup.current.quaternion.setFromUnitVectors(downAxis, craft.sunDir)
    }
    if (coneMaterial.current) {
      coneMaterial.current.opacity = coneReveal * (0.1 + clampFlash * 0.1)
    }
    if (rimMaterial.current) {
      rimMaterial.current.opacity = coneReveal * (0.4 + clampFlash * 0.5)
    }
  })

  return (
    <>
      <group ref={thrustGroup} visible={false}>
        <Line
          points={[
            [0, 0.05, 0],
            [0, 0.52, 0],
          ]}
          color={ENVELOPE_COLOR}
          transparent
          opacity={0}
          lineWidth={2.4}
          onUpdate={(line: THREE.Line) => {
            thrustMaterial.current = line.material as THREE.LineBasicMaterial
          }}
        />
        <mesh ref={thrustTip} position={[0, 0.56, 0]}>
          <coneGeometry args={[0.028, 0.08, 12]} />
          <meshBasicMaterial color={ENVELOPE_COLOR} transparent opacity={0} toneMapped={false} />
        </mesh>
      </group>
      <group ref={sunLineGroup} visible={false}>
        <Line
          points={[
            [0, 0.05, 0],
            [0, 0.5, 0],
          ]}
          color="#94a3b8"
          transparent
          opacity={0}
          lineWidth={1.2}
          dashed
          dashSize={0.035}
          gapSize={0.03}
          onUpdate={(line: THREE.Line) => {
            sunLineMaterial.current = line.material as THREE.LineBasicMaterial
          }}
        />
      </group>
      <group ref={coneGroup} visible={false}>
        <mesh geometry={coneGeometry}>
          <meshBasicMaterial
            ref={coneMaterial}
            color={CONE_COLOR}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <Line
          points={rimPoints}
          color={CONE_COLOR}
          transparent
          opacity={0}
          lineWidth={1.4}
          onUpdate={(line: THREE.Line) => {
            rimMaterial.current = line.material as THREE.LineBasicMaterial
          }}
        />
      </group>
    </>
  )
}

interface FamilyRing {
  radius: number
  height: number
  ideal: boolean
}

const ENVELOPE_FAMILY: FamilyRing[] = [
  // Ideal cos²α reflector family - the territory the classical maps promise.
  ...Array.from({ length: 11 }, (_, i) => ({
    radius: 2.35 - i * 0.145,
    height: 0.2 + i * 0.17,
    ideal: true,
  })),
  // Optical-model family - contracted by the cone ceiling and ×1.23 penalty.
  ...Array.from({ length: 8 }, (_, i) => ({
    radius: 2.22 - i * 0.15,
    height: 0.16 + i * 0.115,
    ideal: false,
  })),
]

/** The paper's headline: ideal territory vs the contracted optical envelope. */
function EnvelopeFamily({ progressRef }: { progressRef: ProgressRef }) {
  const materials = useRef<(THREE.LineBasicMaterial | null)[]>([])
  const smoothProgress = useDampedProgress()

  useFrame((_, delta) => {
    const p = smoothProgress(progressRef.current ?? 0, Math.min(delta, MAX_DELTA))
    ENVELOPE_FAMILY.forEach((ring, index) => {
      const material = materials.current[index]
      if (!material) return
      const stagger = (index % 11) * 0.014
      // Ease out on arrival: each ring lands promptly and settles rather than
      // creeping in on a symmetric curve.
      const reveal = easeOutCubic(range01(p, 0.74 + stagger, 0.84 + stagger))
      material.opacity = reveal * (ring.ideal ? 0.16 : 0.55)
    })
  })

  return (
    <group>
      {ENVELOPE_FAMILY.map((ring, index) => (
        <group
          key={index}
          scale={[ring.radius, 1, ring.radius]}
          position={[0, ring.height, 0]}
        >
          <Line
            points={UNIT_CIRCLE_POINTS}
            color={ring.ideal ? IDEAL_COLOR : ENVELOPE_COLOR}
            transparent
            opacity={0}
            lineWidth={ring.ideal ? 1 : 1.5}
            onUpdate={(line: THREE.Line) => {
              materials.current[index] = line.material as THREE.LineBasicMaterial
            }}
          />
        </group>
      ))}
    </group>
  )
}

/** Ideal-only territory that the cone ceiling excises - flashes and dies. */
function ExcisedRings({ progressRef, reduced }: { progressRef: ProgressRef; reduced: boolean }) {
  const materials = useRef<(THREE.LineBasicMaterial | null)[]>([])
  const smoothProgress = useDampedProgress()
  const rings = useMemo(
    () => [
      { radius: 1.06, height: 1.52 },
      { radius: 0.88, height: 1.74 },
    ],
    [],
  )

  useFrame((state, delta) => {
    const p = smoothProgress(progressRef.current ?? 0, Math.min(delta, MAX_DELTA))
    const window = pulseWindow(p, 0.6, 0.8)
    const flicker = reduced ? 0.7 : 0.55 + Math.sin(state.clock.elapsedTime * 9) * 0.45
    materials.current.forEach((material) => {
      if (material) material.opacity = window * flicker * 0.5
    })
  })

  return (
    <group>
      {rings.map((ring, index) => (
        <group key={index} scale={[ring.radius, 1, ring.radius]} position={[0, ring.height, 0]}>
          <Line
            points={UNIT_CIRCLE_POINTS}
            color={CONE_COLOR}
            transparent
            opacity={0}
            lineWidth={1.2}
            dashed
            dashSize={0.05}
            gapSize={0.05}
            onUpdate={(line: THREE.Line) => {
              materials.current[index] = line.material as THREE.LineBasicMaterial
            }}
          />
        </group>
      ))}
    </group>
  )
}

function SailScene({ progressRef, reduced }: { progressRef: ProgressRef; reduced: boolean }) {
  return (
    <>
      <color attach="background" args={['#030610']} />
      <fog attach="fog" args={['#030610', 7.5, 13]} />
      <ambientLight intensity={0.16} />
      <directionalLight position={[3, 4, 5]} intensity={0.35} color="#818cf8" />
      <CameraRig progressRef={progressRef} />
      <Starfield />
      <Sun />
      <EclipticPlane />
      <KeplerRing progressRef={progressRef} />
      <DisplacedRing progressRef={progressRef} />
      <SailCraft progressRef={progressRef} reduced={reduced} />
      <PhotonStream progressRef={progressRef} />
      <ThrustCone progressRef={progressRef} reduced={reduced} />
      <ExcisedRings progressRef={progressRef} reduced={reduced} />
      <EnvelopeFamily progressRef={progressRef} />
    </>
  )
}

function getTelemetry(progress: number) {
  const p = THREE.MathUtils.clamp(progress, 0, 1)
  let phase = 'Keplerian orbit'
  let phaseDetail = 'Orbit plane passes through the Sun'
  let index = 1
  if (p >= 0.74) {
    phase = 'Optical envelope'
    phaseDetail = 'Ideal territory, contracted ×1.23'
    index = 6
  } else if (p >= 0.56) {
    phase = 'The cone ceiling'
    phaseDetail = 'Thrust ≤ 55.5° off the Sun line'
    index = 5
  } else if (p >= 0.36) {
    phase = 'Lift the ring'
    phaseDetail = 'Displaced non-Keplerian orbit'
    index = 4
  } else if (p >= 0.26) {
    phase = 'Pitch to hover'
    phaseDetail = 'Radiation pressure gains lift'
    index = 3
  } else if (p >= 0.12) {
    phase = 'Sail deploy'
    phaseDetail = '≈10 g/m² aluminized membrane'
    index = 2
  }

  const deploy = smoothstep(range01(p, 0.12, 0.26))
  const pitchF = smoothstep(range01(p, 0.26, 0.38))
  const lift = smoothstep(range01(p, 0.36, 0.58))
  const coneSweep = pulseWindow(p, 0.58, 0.74)

  const beta = 0.16 * lift
  const pitchDeg = Math.min(35.3 * pitchF + 34 * coneSweep, CONE_LIMIT_DEG)
  const displacement = 0.15 * lift
  const radius = THREE.MathUtils.lerp(1.0, 0.95, lift)

  return {
    phase,
    phaseDetail,
    index,
    beta: deploy > 0.05 ? beta.toFixed(2) : '-',
    cone: pitchF > 0.02 ? `${pitchDeg.toFixed(1)}°` : '0.0°',
    displacement: `${displacement.toFixed(2)} au`,
    radius: `${radius.toFixed(2)} au`,
  }
}

export interface SolarSailNKOProps {
  scrollProgress?: number
  progress?: MotionValue<number>
  active?: boolean
  className?: string
}

export function SolarSailNKO({
  scrollProgress = 0,
  progress,
  active = true,
  className = '',
}: SolarSailNKOProps) {
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
        className={`${className} research-viewer--sailnko`}
        progressPercent={Math.round(liveProgress * 100)}
        telemetry={
          <ViewerTelemetry
            label="Displaced NKO"
            rows={[
              { key: 'Phase', value: telemetry.phase },
              { key: 'Lightness β', value: telemetry.beta },
              { key: 'Cone angle', value: telemetry.cone },
              { key: 'Displacement', value: telemetry.displacement },
              { key: 'Orbit ρ', value: telemetry.radius },
            ]}
          />
        }
        legend={
          <div className="research-viewer__legend">
            <span className="research-viewer__legend-item research-viewer__legend-item--sail-photon">
              Photon pressure
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--sail-ring">
              Displaced NKO
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--sail-cone">
              55.5° cone limit
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--sail-envelope">
              Optical envelope
            </span>
          </div>
        }
      >
        <Canvas
          camera={{ position: [3.0, 0.62, 4.5], fov: 38, near: 0.1, far: 40 }}
          dpr={[1, 1.5]}
          gl={{
            alpha: true,
            antialias: false,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
          }}
          frameloop={isVisible && active ? 'always' : 'demand'}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <SailScene progressRef={progressRef} reduced={reduced} />
          </Suspense>
        </Canvas>
        <div className="viewer-phase" aria-hidden="true">
          <span className="viewer-phase__index">{String(telemetry.index).padStart(2, '0')}</span>
          <span className="viewer-phase__copy">
            <strong>{telemetry.phase}</strong>
            <small>{telemetry.phaseDetail}</small>
          </span>
        </div>
      </ResearchViewerFrame>
    </div>
  )
}
