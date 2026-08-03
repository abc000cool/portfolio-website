import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, Line } from '@react-three/drei'
import { useMotionValue, useMotionValueEvent, useSpring, type MotionValue } from 'motion/react'
import * as THREE from 'three'
import { useIntersectionPause } from '../../hooks/useIntersectionPause'
import { useMotionProgressRef } from '../../hooks/useMotionProgressRef'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useThrottledMotionValue } from '../../hooks/useThrottledMotionValue'
import { smoothstep } from '../../lib/airfoilGeometry'
import { ResearchViewerFrame, ViewerTelemetry } from '../research/ResearchViewerFrame'

const ATOMS_PER_PACKET = 54
const ATOM_COLOR = '#a5b4fc'
const ATOM_SECONDARY = '#c4b5fd'
const CLASSICAL_COLOR = '#fbbf24'
const HYBRID_COLOR = '#86efac'
const CAI_COLOR = '#818cf8'
const METAL_COLOR = '#64748b'
const DARK_METAL = '#111827'

// Hoisted so no frame has to parse a colour string or allocate a THREE.Color.
const COLOR_CLASSICAL = new THREE.Color(CLASSICAL_COLOR)
const COLOR_HYBRID = new THREE.Color(HYBRID_COLOR)

// This canvas parks on frameloop "demand" while the section is off screen, so
// the first delta after it wakes can be seconds long. Everything below steps on
// a clamped delta so exponential smoothing converges instead of lurching.
const MAX_STEP = 0.05
// Approach rate for the shared scroll follower: fast enough to stay glued to
// the scrub, slow enough to swallow wheel and trackpad jitter.
const PROGRESS_LAMBDA = 11
// Base approach rate for individual atoms. Spread per atom so the cloud smears
// along its direction of travel instead of moving as one rigid blob.
const ATOM_LAMBDA_MIN = 4
const ATOM_LAMBDA_SPAN = 11

type ProgressRef = React.RefObject<number | null>

interface AtomSeed {
  x: number
  y: number
  z: number
  scale: number
  phase: number
}

function range01(value: number, start: number, end: number): number {
  if (end <= start) return value >= end ? 1 : 0
  return THREE.MathUtils.clamp((value - start) / (end - start), 0, 1)
}

function pulseWindow(progress: number, start: number, end: number): number {
  return Math.sin(range01(progress, start, end) * Math.PI)
}

/** Clamp a frame delta so a woken canvas cannot take one enormous step. */
function frameStep(delta: number): number {
  if (!(delta > 0)) return 0
  return delta > MAX_STEP ? MAX_STEP : delta
}

/** Fractional part, correct for negative input, so modulo cycles never flip sign. */
function wrap01(value: number): number {
  return value - Math.floor(value)
}

function easeOutCubic(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1)
  return 1 - Math.pow(1 - x, 3)
}

function easeInOutQuart(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1)
  return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2
}

function deterministicSeeds(count: number): AtomSeed[] {
  return Array.from({ length: count }, (_, index) => {
    const u = (index + 0.5) / count
    const theta = index * 2.399963229728653
    const radius = Math.sqrt(u)
    return {
      x: Math.cos(theta) * radius,
      y: Math.sin(theta) * radius,
      z: Math.sin(theta * 1.7) * (1 - u),
      scale: 0.72 + ((index * 37) % 29) / 100,
      phase: ((index * 53) % count) / count,
    }
  })
}

/**
 * One place that turns the raw scroll value into a damped one. Every other
 * useFrame in this scene reads the damped ref, so scroll jitter is filtered
 * once and the whole instrument stays in phase with itself.
 */
function ProgressSmoother({
  rawRef,
  smoothRef,
}: {
  rawRef: ProgressRef
  smoothRef: React.RefObject<number>
}) {
  const readyRef = useRef(false)
  // Negative priority only affects ordering: R3F keeps auto-rendering unless a
  // subscriber asks for a priority above zero. This guarantees the smoothed
  // value is fresh before any consumer in this scene reads it.
  useFrame((_, delta) => {
    const target = THREE.MathUtils.clamp(rawRef.current ?? 0, 0, 1)
    if (!readyRef.current) {
      readyRef.current = true
      smoothRef.current = target
      return
    }
    smoothRef.current = THREE.MathUtils.damp(
      smoothRef.current,
      target,
      PROGRESS_LAMBDA,
      frameStep(delta),
    )
  }, -1)
  return null
}

function CameraRig({ progressRef }: { progressRef: ProgressRef }) {
  const { camera } = useThree()
  const positionRef = useRef(new THREE.Vector3())
  const targetRef = useRef(new THREE.Vector3())
  const lookRef = useRef(new THREE.Vector3(-0.76, 0.02, 0))
  const readyRef = useRef(false)

  useFrame((_, delta) => {
    const dt = frameStep(delta)
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const reveal = smoothstep(range01(p, 0.58, 0.74))
    const settle = smoothstep(range01(p, 0.86, 1))
    const position = positionRef.current
    const target = targetRef.current

    position.set(
      THREE.MathUtils.lerp(-0.72, 0.18, reveal) + settle * 0.08,
      THREE.MathUtils.lerp(0.2, 0.36, reveal),
      THREE.MathUtils.lerp(4.35, 5.25, reveal),
    )
    target.set(
      THREE.MathUtils.lerp(-0.76, 0.08, reveal),
      THREE.MathUtils.lerp(0.02, 0.06, reveal),
      0,
    )

    if (!readyRef.current) {
      camera.position.copy(position)
      lookRef.current.copy(target)
      readyRef.current = true
    } else {
      // Frame-rate independent follow. The old fixed 0.12 alpha meant the
      // camera moved at a different speed on a 120 Hz display.
      camera.position.lerp(position, 1 - Math.exp(-7 * dt))
      // The look-at point is damped too, otherwise every scroll tick lands
      // straight on the camera's rotation.
      lookRef.current.lerp(target, 1 - Math.exp(-5.5 * dt))
    }
    camera.lookAt(lookRef.current)
  })

  return null
}

function InstrumentStage() {
  return (
    <group>
      <Grid
        args={[8, 5]}
        position={[0, -1.08, 0]}
        rotation={[0, 0, 0]}
        cellSize={0.25}
        cellThickness={0.25}
        sectionSize={1}
        sectionThickness={0.5}
        cellColor="#1e293b"
        sectionColor="#334155"
        fadeDistance={7}
        fadeStrength={1.7}
      />
      <mesh position={[0, -1.04, -0.05]} receiveShadow>
        <boxGeometry args={[4.8, 0.08, 1.8]} />
        <meshStandardMaterial color="#080d18" metalness={0.62} roughness={0.42} />
      </mesh>
      <mesh position={[0, -0.98, 0.86]}>
        <boxGeometry args={[4.8, 0.025, 0.035]} />
        <meshStandardMaterial
          color={CAI_COLOR}
          emissive={CAI_COLOR}
          emissiveIntensity={0.8}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

function Flange({
  y,
  scale = 1,
}: {
  y: number
  scale?: number
}) {
  return (
    <group position={[0, y, 0]} scale={scale}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.65, 0.65, 0.11, 48]} />
        <meshPhysicalMaterial
          color={METAL_COLOR}
          metalness={0.88}
          roughness={0.2}
          clearcoat={0.35}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.52, 0.025, 10, 48]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.15} />
      </mesh>
      {Array.from({ length: 10 }, (_, index) => {
        const angle = (index / 10) * Math.PI * 2
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * 0.57, 0, Math.sin(angle) * 0.57]}
          >
            <cylinderGeometry args={[0.025, 0.025, 0.14, 10]} />
            <meshStandardMaterial color="#dbe4ee" metalness={0.92} roughness={0.18} />
          </mesh>
        )
      })}
    </group>
  )
}

function VacuumChamber() {
  return (
    <group position={[-0.92, 0.02, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.54, 0.54, 1.7, 48, 1, true]} />
        <meshPhysicalMaterial
          color="#243247"
          metalness={0.72}
          roughness={0.24}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh>
        <cylinderGeometry args={[0.505, 0.505, 1.61, 48, 1, true]} />
        <meshPhysicalMaterial
          color="#a5b4fc"
          roughness={0.08}
          metalness={0}
          transmission={0.88}
          thickness={0.18}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <Flange y={0.88} />
      <Flange y={-0.88} />

      <group position={[0, 0.03, 0.5]}>
        <mesh>
          <torusGeometry args={[0.35, 0.055, 14, 48]} />
          <meshPhysicalMaterial
            color="#94a3b8"
            metalness={0.88}
            roughness={0.2}
            clearcoat={0.45}
          />
        </mesh>
        <mesh position={[0, 0, 0.012]}>
          <circleGeometry args={[0.315, 48]} />
          <meshPhysicalMaterial
            color="#b4c6ff"
            transmission={0.92}
            thickness={0.08}
            roughness={0.05}
            transparent
            opacity={0.17}
            depthWrite={false}
          />
        </mesh>
      </group>

      <mesh position={[-0.63, 0.28, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.48, 24]} />
        <meshStandardMaterial color="#475569" metalness={0.82} roughness={0.25} />
      </mesh>
      <mesh position={[0.63, 0.28, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.48, 24]} />
        <meshStandardMaterial color="#475569" metalness={0.82} roughness={0.25} />
      </mesh>

      <mesh position={[0, -0.89, 0.48]}>
        <boxGeometry args={[0.72, 0.09, 0.36]} />
        <meshStandardMaterial color={DARK_METAL} metalness={0.72} roughness={0.3} />
      </mesh>
    </group>
  )
}

function OpticalBench() {
  return (
    <group position={[-0.92, -0.98, 0.1]}>
      <mesh position={[-0.78, 0.16, 0]} castShadow>
        <boxGeometry args={[0.55, 0.22, 0.62]} />
        <meshPhysicalMaterial color="#293548" metalness={0.76} roughness={0.24} clearcoat={0.25} />
      </mesh>
      <mesh position={[0.78, 0.16, 0]} castShadow>
        <boxGeometry args={[0.55, 0.22, 0.62]} />
        <meshPhysicalMaterial color="#293548" metalness={0.76} roughness={0.24} clearcoat={0.25} />
      </mesh>
      {[-0.78, 0.78].map((x) => (
        <group key={x} position={[x, 0.34, 0.08]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.14, 28]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.18} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.075, 0.075, 0.035, 28]} />
            <meshPhysicalMaterial
              color="#667eea"
              emissive="#4338ca"
              emissiveIntensity={0.7}
              roughness={0.08}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function AtomPacket({
  packet,
  progressRef,
  reduced,
}: {
  packet: 'upper' | 'lower'
  progressRef: ProgressRef
  reduced: boolean
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const glowRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const seeds = useMemo(() => deterministicSeeds(ATOMS_PER_PACKET), [])
  // Per-atom current position, so each atom can lag its own target slightly.
  // Allocated once on the first frame, never per frame.
  const trailRef = useRef<Float32Array | null>(null)
  const sign = packet === 'upper' ? 1 : -1

  useFrame((state, delta) => {
    const mesh = meshRef.current
    const glow = glowRef.current
    if (!mesh || !glow) return

    const dt = frameStep(delta)
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const cool = smoothstep(range01(p, 0, 0.12))
    const handoff = smoothstep(range01(p, 0.62, 0.72))
    const time = state.clock.elapsedTime

    let separation = 0
    let centerY = THREE.MathUtils.lerp(-0.16, -0.12, cool)
    if (p >= 0.12 && p < 0.28) {
      const phase = range01(p, 0.12, 0.28)
      // The pi/2 pulse is an impulse: the arms part hard, then coast apart.
      separation = THREE.MathUtils.lerp(0, 0.25, easeOutCubic(phase))
      centerY = THREE.MathUtils.lerp(-0.12, 0.02, smoothstep(phase))
    } else if (p >= 0.28 && p < 0.42) {
      const phase = smoothstep(range01(p, 0.28, 0.42))
      separation = 0.25
      centerY = THREE.MathUtils.lerp(0.02, 0.2, phase)
    } else if (p >= 0.42 && p < 0.52) {
      const phase = smoothstep(range01(p, 0.42, 0.52))
      separation = THREE.MathUtils.lerp(0.25, 0.18, phase)
      centerY = THREE.MathUtils.lerp(0.2, 0.36, phase)
    } else if (p >= 0.52) {
      const phase = range01(p, 0.52, 0.62)
      // Recombination hangs, rushes together, then settles rather than
      // sliding home at a constant rate.
      separation = THREE.MathUtils.lerp(0.18, 0, easeInOutQuart(phase))
      centerY = THREE.MathUtils.lerp(0.36, 0.52, smoothstep(phase))
    }

    const centerX = -0.92 + sign * separation

    const packetRadius = THREE.MathUtils.lerp(0.16, 0.09, cool)
    const opacity = THREE.MathUtils.lerp(0.96, 0.18, handoff)
    // A wave packet smears along the axis it is being pushed along, and pulls
    // in across it. Both beats here push along x.
    const stretch =
      1 + Math.max(pulseWindow(p, 0.12, 0.28), pulseWindow(p, 0.52, 0.62)) * 0.42
    const squash = 1 / Math.sqrt(stretch)

    let trail = trailRef.current
    // First populated frame seeds the trail, so nothing eases in from origin.
    const ready = trail !== null && trail.length === seeds.length * 2
    if (trail === null || trail.length !== seeds.length * 2) {
      trail = new Float32Array(seeds.length * 2)
      trailRef.current = trail
    }

    for (let index = 0; index < seeds.length; index += 1) {
      const seed = seeds[index]
      if (!seed) continue
      const breathe = reduced
        ? 1
        : 1 + Math.sin(time * 1.5 + seed.phase * Math.PI * 2) * 0.035
      const targetX = centerX + seed.x * packetRadius * stretch * breathe
      const targetY = centerY + seed.y * packetRadius * 0.72 * squash * breathe
      const lambda = ATOM_LAMBDA_MIN + seed.phase * ATOM_LAMBDA_SPAN
      const xi = index * 2
      const yi = xi + 1
      // After the seed frame each atom eases to its target on a clamped delta,
      // which stays correct when the loop resumes from a paused canvas.
      const nextX = ready ? THREE.MathUtils.damp(trail[xi], targetX, lambda, dt) : targetX
      const nextY = ready ? THREE.MathUtils.damp(trail[yi], targetY, lambda, dt) : targetY
      trail[xi] = nextX
      trail[yi] = nextY

      dummy.position.set(nextX, nextY, seed.z * packetRadius * 0.6 + 0.22)
      dummy.scale.setScalar(0.019 * seed.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)

      dummy.scale.setScalar(0.038 * seed.scale)
      dummy.updateMatrix()
      glow.setMatrixAt(index, dummy.matrix)
    }

    mesh.instanceMatrix.needsUpdate = true
    glow.instanceMatrix.needsUpdate = true
    ;(mesh.material as THREE.MeshStandardMaterial).opacity = opacity
    ;(glow.material as THREE.MeshBasicMaterial).opacity = opacity * 0.12
  })

  return (
    <>
      <instancedMesh ref={glowRef} args={[undefined, undefined, ATOMS_PER_PACKET]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          color={packet === 'upper' ? ATOM_COLOR : ATOM_SECONDARY}
          transparent
          opacity={0.12}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh ref={meshRef} args={[undefined, undefined, ATOMS_PER_PACKET]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial
          color={packet === 'upper' ? ATOM_COLOR : ATOM_SECONDARY}
          emissive={packet === 'upper' ? '#4f46e5' : '#7c3aed'}
          emissiveIntensity={1.4}
          transparent
          opacity={0.96}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
    </>
  )
}

function MatterWavePaths({ progressRef }: { progressRef: ProgressRef }) {
  const upperRef = useRef<THREE.Group>(null)
  const lowerRef = useRef<THREE.Group>(null)
  const upperMaterialRef = useRef<THREE.LineBasicMaterial | null>(null)
  const lowerMaterialRef = useRef<THREE.LineBasicMaterial | null>(null)

  const upperPoints = useMemo(
    () => [
      new THREE.Vector3(-0.92, -0.16, 0.2),
      new THREE.Vector3(-0.72, 0.02, 0.2),
      new THREE.Vector3(-0.67, 0.2, 0.2),
      new THREE.Vector3(-0.78, 0.38, 0.2),
      new THREE.Vector3(-0.92, 0.52, 0.2),
    ],
    [],
  )
  const lowerPoints = useMemo(
    () => [
      new THREE.Vector3(-0.92, -0.16, 0.2),
      new THREE.Vector3(-1.12, 0.02, 0.2),
      new THREE.Vector3(-1.17, 0.2, 0.2),
      new THREE.Vector3(-1.06, 0.38, 0.2),
      new THREE.Vector3(-0.92, 0.52, 0.2),
    ],
    [],
  )

  useFrame(() => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const show = smoothstep(range01(p, 0.1, 0.22))
    const fade = 1 - 0.82 * smoothstep(range01(p, 0.62, 0.74))
    const opacity = show * fade * 0.78
    // Both arms are drawn by the same pulse, so they stay in lockstep. No
    // stagger here on purpose: a coherent split is simultaneous.
    if (upperRef.current) upperRef.current.visible = opacity > 0.015
    if (lowerRef.current) lowerRef.current.visible = opacity > 0.015
    if (upperMaterialRef.current) upperMaterialRef.current.opacity = opacity
    if (lowerMaterialRef.current) lowerMaterialRef.current.opacity = opacity
  })

  return (
    <>
      <group ref={upperRef} visible={false}>
        <Line
          points={upperPoints}
          color={ATOM_COLOR}
          transparent
          opacity={0}
          lineWidth={2}
          onUpdate={(line: THREE.Line) => {
            upperMaterialRef.current = line.material as THREE.LineBasicMaterial
          }}
        />
      </group>
      <group ref={lowerRef} visible={false}>
        <Line
          points={lowerPoints}
          color={ATOM_SECONDARY}
          transparent
          opacity={0}
          lineWidth={2}
          onUpdate={(line: THREE.Line) => {
            lowerMaterialRef.current = line.material as THREE.LineBasicMaterial
          }}
        />
      </group>
    </>
  )
}

function RamanPulse({
  progressRef,
  phase,
  y,
  reduced,
}: {
  progressRef: ProgressRef
  phase: [number, number]
  y: number
  reduced: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.MeshStandardMaterial>(null)
  const haloRef = useRef<THREE.MeshBasicMaterial>(null)
  const levelRef = useRef(0)

  useFrame((state, delta) => {
    const group = groupRef.current
    const core = coreRef.current
    const halo = haloRef.current
    if (!group || !core || !halo) return
    const dt = frameStep(delta)
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    // Damped so a nudge of the scroll wheel cannot strobe the beam.
    levelRef.current = THREE.MathUtils.damp(
      levelRef.current,
      pulseWindow(p, phase[0], phase[1]),
      13,
      dt,
    )
    const pulse = levelRef.current
    group.visible = pulse > 0.025
    if (!group.visible) return
    const shimmer = reduced ? 1 : 1 + Math.sin(state.clock.elapsedTime * 9 + y * 4) * 0.06
    group.scale.x = 0.65 + pulse * 0.45
    core.emissiveIntensity = (1 + pulse * 4) * shimmer
    core.opacity = pulse * 0.95
    halo.opacity = pulse * 0.16 * shimmer
  })

  return (
    <group ref={groupRef} position={[-0.92, y, 0.23]} visible={false}>
      <mesh>
        <boxGeometry args={[1.35, 0.022, 0.055]} />
        <meshStandardMaterial
          ref={coreRef}
          color="#e0e7ff"
          emissive={CAI_COLOR}
          emissiveIntensity={1}
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <boxGeometry args={[1.48, 0.085, 0.12]} />
        <meshBasicMaterial
          ref={haloRef}
          color={CAI_COLOR}
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

function FringeDetector({ progressRef }: { progressRef: ProgressRef }) {
  const groupRef = useRef<THREE.Group>(null)
  const detectorMaterial = useRef<THREE.MeshStandardMaterial>(null)
  const bars = useRef<THREE.Mesh[]>([])
  const levelRef = useRef(0)
  const buildRef = useRef(0)

  useFrame((_, delta) => {
    const group = groupRef.current
    const detector = detectorMaterial.current
    if (!group || !detector) return
    const dt = frameStep(delta)
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    levelRef.current = THREE.MathUtils.damp(
      levelRef.current,
      pulseWindow(p, 0.52, 0.65),
      9,
      dt,
    )
    // Fringe contrast accumulates across the readout rather than arriving at
    // full strength on the first frame the detector is visible.
    buildRef.current = THREE.MathUtils.damp(
      buildRef.current,
      smoothstep(range01(p, 0.52, 0.63)),
      6,
      dt,
    )
    const level = levelRef.current
    const build = buildRef.current
    group.visible = level > 0.02
    if (!group.visible) return
    detector.emissiveIntensity = 0.3 + level * 3.5

    for (let index = 0; index < bars.current.length; index += 1) {
      const bar = bars.current[index]
      if (!bar) continue
      // The central fringe lands first and the outer orders fill in behind it.
      const order = Math.abs(index - 4) / 4
      const gate = smoothstep(range01(build, order * 0.55, order * 0.55 + 0.45))
      const amount = level * gate
      const material = bar.material as THREE.MeshBasicMaterial
      // Starts as a wash, then separates into bright and dark orders.
      material.opacity = amount * THREE.MathUtils.lerp(0.5, index % 2 === 0 ? 0.8 : 0.28, build)
      bar.scale.y = 0.55 + amount * 0.45
    }
  })

  return (
    <group ref={groupRef} position={[-0.92, 0.58, 0.34]} visible={false}>
      <mesh>
        <cylinderGeometry args={[0.29, 0.29, 0.065, 40]} />
        <meshStandardMaterial
          ref={detectorMaterial}
          color="#1e293b"
          emissive={CAI_COLOR}
          emissiveIntensity={0.3}
          metalness={0.72}
          roughness={0.24}
        />
      </mesh>
      <group position={[0, 0, 0.045]}>
        {Array.from({ length: 9 }, (_, index) => (
          <mesh
            key={index}
            ref={(mesh) => {
              if (mesh) bars.current[index] = mesh
            }}
            position={[(index - 4) * 0.052, 0, 0]}
          >
            <boxGeometry args={[0.022, 0.38, 0.012]} />
            <meshBasicMaterial
              color={index % 2 === 0 ? '#eef2ff' : CAI_COLOR}
              transparent
              opacity={0}
              toneMapped={false}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function StatusLight({
  position,
  color,
}: {
  position: [number, number, number]
  color: string
}) {
  return (
    <mesh position={position}>
      <circleGeometry args={[0.035, 20]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.8}
        toneMapped={false}
      />
    </mesh>
  )
}

function AvionicsModule({
  progressRef,
  reduced,
}: {
  progressRef: ProgressRef
  reduced: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const lockLightRef = useRef<THREE.MeshStandardMaterial>(null)
  const imuRef = useRef<THREE.Group>(null)
  const lockedRef = useRef(0)

  useFrame((state, delta) => {
    const dt = frameStep(delta)
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const reveal = smoothstep(range01(p, 0.58, 0.72))
    const drift = smoothstep(range01(p, 0.62, 0.78))
    // The filter converging is a settle, not a switch, so the lock carries its
    // own damped copy rather than being read straight off the scroll.
    lockedRef.current = THREE.MathUtils.damp(
      lockedRef.current,
      smoothstep(range01(p, 0.84, 0.96)),
      4,
      dt,
    )
    const lock = lockedRef.current
    const time = state.clock.elapsedTime

    if (groupRef.current) {
      groupRef.current.visible = reveal > 0.015
      groupRef.current.position.y = THREE.MathUtils.lerp(-0.08, 0, reveal)
    }
    if (imuRef.current) {
      // Residual wander dies off faster than it built, so the box comes to
      // rest instead of stopping dead.
      const residual = reduced ? 0 : drift * Math.pow(1 - lock, 1.8)
      imuRef.current.rotation.z =
        (Math.sin(time * 2.2) * 0.014 + Math.sin(time * 3.7 + 1.1) * 0.006) * residual
      imuRef.current.rotation.x = Math.sin(time * 1.6 + 0.6) * 0.008 * residual
    }
    if (lockLightRef.current) {
      // Used to flip amber to green in one frame at lock > 0.5.
      lockLightRef.current.color.lerpColors(COLOR_CLASSICAL, COLOR_HYBRID, lock)
      lockLightRef.current.emissive.lerpColors(COLOR_CLASSICAL, COLOR_HYBRID, lock)
      const capture = Math.exp(-Math.pow((lock - 0.5) * 4.2, 2))
      lockLightRef.current.emissiveIntensity = 0.8 + lock * 3.2 + capture * 1.4
    }
  })

  return (
    <group ref={groupRef} position={[0, -0.08, 0]} visible={false}>
      <mesh position={[0.9, -0.78, 0]} castShadow>
        <boxGeometry args={[1.55, 0.16, 1.1]} />
        <meshPhysicalMaterial color="#1b2433" metalness={0.8} roughness={0.26} clearcoat={0.3} />
      </mesh>
      <mesh position={[0.9, -0.67, 0.48]}>
        <boxGeometry args={[1.42, 0.04, 0.06]} />
        <meshStandardMaterial color={CAI_COLOR} emissive={CAI_COLOR} emissiveIntensity={0.65} />
      </mesh>

      <group ref={imuRef} position={[0.65, -0.34, 0.05]}>
        <mesh castShadow>
          <boxGeometry args={[0.72, 0.58, 0.72]} />
          <meshPhysicalMaterial
            color="#2c394d"
            metalness={0.78}
            roughness={0.22}
            clearcoat={0.45}
          />
        </mesh>
        <mesh position={[0, 0.01, 0.37]}>
          <boxGeometry args={[0.53, 0.36, 0.035]} />
          <meshStandardMaterial color="#070b13" metalness={0.45} roughness={0.32} />
        </mesh>
        <mesh position={[0, 0.01, 0.395]}>
          <boxGeometry args={[0.32, 0.13, 0.014]} />
          <meshStandardMaterial
            color={CAI_COLOR}
            emissive={CAI_COLOR}
            emissiveIntensity={0.9}
            toneMapped={false}
          />
        </mesh>
        {[
          [-0.28, -0.2],
          [0.28, -0.2],
          [-0.28, 0.2],
          [0.28, 0.2],
        ].map(([x, y]) => (
          <mesh key={`${x}-${y}`} position={[x, y, 0.395]}>
            <circleGeometry args={[0.025, 16]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.18} />
          </mesh>
        ))}
      </group>

      <group position={[1.25, -0.31, 0.1]}>
        <mesh castShadow>
          <boxGeometry args={[0.42, 0.52, 0.62]} />
          <meshPhysicalMaterial color="#182131" metalness={0.72} roughness={0.25} clearcoat={0.25} />
        </mesh>
        <mesh position={[0, 0, 0.325]}>
          <boxGeometry args={[0.29, 0.34, 0.025]} />
          <meshStandardMaterial color="#060a10" metalness={0.38} roughness={0.4} />
        </mesh>
        <StatusLight position={[-0.08, 0.08, 0.342]} color={CAI_COLOR} />
        <mesh position={[0.08, 0.08, 0.342]}>
          <circleGeometry args={[0.035, 20]} />
          <meshStandardMaterial
            ref={lockLightRef}
            color={CLASSICAL_COLOR}
            emissive={CLASSICAL_COLOR}
            emissiveIntensity={0.8}
            toneMapped={false}
          />
        </mesh>
        <StatusLight position={[-0.08, -0.08, 0.342]} color="#38bdf8" />
        <StatusLight position={[0.08, -0.08, 0.342]} color="#64748b" />
      </group>

      <group position={[0.65, -0.34, 0.44]}>
        <Line points={[[0, 0, 0], [0.14, 0, 0]]} color="#f87171" lineWidth={2} />
        <Line points={[[0, 0, 0], [0, 0.14, 0]]} color={HYBRID_COLOR} lineWidth={2} />
        <Line points={[[0, 0, 0], [0, 0, 0.14]]} color="#60a5fa" lineWidth={2} />
      </group>
    </group>
  )
}

function FusionBus({
  progressRef,
  reduced,
}: {
  progressRef: ProgressRef
  reduced: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const packets = useRef<THREE.Mesh[]>([])
  const busMaterial = useRef<THREE.LineBasicMaterial | null>(null)
  const start = useMemo(() => new THREE.Vector3(-0.25, -0.2, 0.28), [])
  const finish = useMemo(() => new THREE.Vector3(0.86, -0.2, 0.28), [])
  // Accumulated phase rather than progress * 3.1, so packets keep a steady
  // rate instead of stuttering with the scroll.
  const phaseRef = useRef(0)

  useFrame((_, delta) => {
    const dt = frameStep(delta)
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const reveal = smoothstep(range01(p, 0.64, 0.74))
    const update = smoothstep(range01(p, 0.72, 0.88))
    const locked = smoothstep(range01(p, 0.88, 1))
    const flow = update * (1 - locked)
    if (groupRef.current) groupRef.current.visible = reveal > 0.02
    if (busMaterial.current) busMaterial.current.opacity = reveal * (0.35 + locked * 0.35)

    if (reduced) {
      // No self-running loop: the phase stays tied to the scrub.
      phaseRef.current = wrap01(update * 3.1)
    } else {
      phaseRef.current = wrap01(phaseRef.current + dt * (0.34 + update * 0.52))
    }

    for (let index = 0; index < packets.current.length; index += 1) {
      const packet = packets.current[index]
      if (!packet) continue
      const cycle = wrap01(phaseRef.current - index * 0.34)
      // Grow in at the estimator and shrink out at the filter, so the modulo
      // wrap never shows as a packet blinking out mid air.
      const fade =
        smoothstep(range01(cycle, 0, 0.16)) * (1 - smoothstep(range01(cycle, 0.8, 1)))
      // Later packets only join once the update beat is properly under way.
      const entry = smoothstep(range01(update, index * 0.1, index * 0.1 + 0.2))
      // Saturates early so a running packet reaches full size mid travel, then
      // shrinks away for good as the filter locks.
      const presence = smoothstep(THREE.MathUtils.clamp(flow * entry * 1.8, 0, 1))
      const amount = fade * presence
      packet.visible = amount > 0.01
      if (!packet.visible) continue
      packet.position.lerpVectors(start, finish, cycle)
      packet.scale.setScalar(amount)
      packet.rotation.z = Math.PI / 4
      packet.rotation.y = reduced ? 0 : cycle * Math.PI * 2
      const material = packet.material as THREE.MeshStandardMaterial
      material.emissiveIntensity = 0.6 + amount * (2.4 + Math.sin(cycle * Math.PI) * 2)
    }
  })

  return (
    <group ref={groupRef} visible={false}>
      <Line
        points={[start, finish]}
        color={CAI_COLOR}
        transparent
        opacity={0}
        lineWidth={1.5}
        dashed
        dashSize={0.06}
        gapSize={0.045}
        onUpdate={(line: THREE.Line) => {
          busMaterial.current = line.material as THREE.LineBasicMaterial
        }}
      />
      {Array.from({ length: 3 }, (_, index) => (
        <mesh
          key={index}
          ref={(mesh) => {
            if (mesh) packets.current[index] = mesh
          }}
          visible={false}
        >
          <octahedronGeometry args={[0.055, 0]} />
          <meshStandardMaterial
            color="#e0e7ff"
            emissive={CAI_COLOR}
            emissiveIntensity={2.4}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

function UncertaintyEnvelope({
  progressRef,
  reduced,
}: {
  progressRef: ProgressRef
  reduced: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const classicalRef = useRef<THREE.Mesh>(null)
  const hybridRef = useRef<THREE.Mesh>(null)
  const trajectoryMaterial = useRef<THREE.LineBasicMaterial | null>(null)
  const lockedRef = useRef(0)

  useFrame((state, delta) => {
    const dt = frameStep(delta)
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const reveal = smoothstep(range01(p, 0.62, 0.73))
    const drift = smoothstep(range01(p, 0.65, 0.82))
    lockedRef.current = THREE.MathUtils.damp(
      lockedRef.current,
      smoothstep(range01(p, 0.82, 0.97)),
      4,
      dt,
    )
    const lock = lockedRef.current
    const time = state.clock.elapsedTime
    if (groupRef.current) groupRef.current.visible = reveal > 0.02
    if (trajectoryMaterial.current) trajectoryMaterial.current.opacity = reveal * 0.52

    if (classicalRef.current) {
      // The unbounded estimate breathes; the bounded one does not. Ambient
      // only, so it is flat under prefers-reduced-motion.
      const unease = reduced
        ? 0
        : (Math.sin(time * 1.3) * 0.55 + Math.sin(time * 2.9 + 1.7) * 0.45) *
          0.05 *
          drift *
          (1 - lock)
      classicalRef.current.scale.y = (0.15 + drift * 0.85) * (1 + unease)
      const material = classicalRef.current.material as THREE.MeshBasicMaterial
      material.opacity = reveal * (0.22 - lock * 0.15)
    }
    if (hybridRef.current) {
      hybridRef.current.scale.y = THREE.MathUtils.lerp(0.5, 0.18, lock)
      const material = hybridRef.current.material as THREE.MeshBasicMaterial
      material.opacity = reveal * lock * 0.3
    }
  })

  return (
    <group ref={groupRef} visible={false}>
      <Line
        points={[[1.42, -0.3, 0.06], [2.45, -0.3, 0.06]]}
        color="#e2e8f0"
        transparent
        opacity={0}
        lineWidth={1.2}
        dashed
        dashSize={0.055}
        gapSize={0.045}
        onUpdate={(line: THREE.Line) => {
          trajectoryMaterial.current = line.material as THREE.LineBasicMaterial
        }}
      />
      <mesh
        ref={classicalRef}
        position={[1.94, -0.3, 0.06]}
        rotation={[0, 0, -Math.PI / 2]}
        scale={[1, 0.15, 1]}
      >
        <coneGeometry args={[0.43, 1.03, 32, 1, true]} />
        <meshBasicMaterial
          color={CLASSICAL_COLOR}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh
        ref={hybridRef}
        position={[1.94, -0.3, 0.05]}
        rotation={[0, 0, -Math.PI / 2]}
        scale={[1, 0.5, 1]}
      >
        <coneGeometry args={[0.28, 1.03, 32, 1, true]} />
        <meshBasicMaterial
          color={HYBRID_COLOR}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

function HybridNavigatorRig({
  progressRef,
  reduced,
}: {
  progressRef: ProgressRef
  reduced: boolean
}) {
  return (
    <group position={[0, 0.03, 0]}>
      <InstrumentStage />
      <VacuumChamber />
      <OpticalBench />
      <MatterWavePaths progressRef={progressRef} />
      <AtomPacket packet="upper" progressRef={progressRef} reduced={reduced} />
      <AtomPacket packet="lower" progressRef={progressRef} reduced={reduced} />
      <RamanPulse progressRef={progressRef} phase={[0.12, 0.28]} y={-0.2} reduced={reduced} />
      <RamanPulse progressRef={progressRef} phase={[0.42, 0.52]} y={0.24} reduced={reduced} />
      <RamanPulse progressRef={progressRef} phase={[0.52, 0.62]} y={0.57} reduced={reduced} />
      <FringeDetector progressRef={progressRef} />
      <AvionicsModule progressRef={progressRef} reduced={reduced} />
      <FusionBus progressRef={progressRef} reduced={reduced} />
      <UncertaintyEnvelope progressRef={progressRef} reduced={reduced} />
    </group>
  )
}

function QcinScene({
  progressRef,
  reduced,
}: {
  progressRef: ProgressRef
  reduced: boolean
}) {
  // Seeded from the raw ref by ProgressSmoother on its first frame.
  const smoothProgress = useRef(0)
  return (
    <>
      <color attach="background" args={['#040711']} />
      <fog attach="fog" args={['#040711', 6.5, 10]} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[4, 5, 5]} intensity={1.8} color="#f8fafc" castShadow />
      <directionalLight position={[-4, 2, 3]} intensity={0.75} color="#818cf8" />
      <pointLight position={[-0.9, 0.2, 1.7]} intensity={1.4} color="#a5b4fc" distance={4} />
      <pointLight position={[1.1, 0, 1.4]} intensity={0.7} color="#86efac" distance={3} />
      <ProgressSmoother rawRef={progressRef} smoothRef={smoothProgress} />
      <CameraRig progressRef={smoothProgress} />
      <HybridNavigatorRig progressRef={smoothProgress} reduced={reduced} />
    </>
  )
}

function getTelemetry(progress: number) {
  const p = THREE.MathUtils.clamp(progress, 0, 1)
  let phase = 'Laser cool'
  let phaseDetail = 'Rb-87 cloud preparation'
  if (p >= 0.88) {
    phase = 'Hybrid lock'
    phaseDetail = 'Bounded inertial solution'
  } else if (p >= 0.72) {
    phase = 'CAI correction'
    phaseDetail = 'Quantum bias update'
  } else if (p >= 0.62) {
    phase = 'IMU propagation'
    phaseDetail = 'Classical drift growth'
  } else if (p >= 0.52) {
    phase = 'π/2 recombine'
    phaseDetail = 'Phase fringe readout'
  } else if (p >= 0.42) {
    phase = 'π mirror'
    phaseDetail = 'Momentum reversal'
  } else if (p >= 0.28) {
    phase = 'Free evolution'
    phaseDetail = 'Matter-wave separation'
  } else if (p >= 0.12) {
    phase = 'π/2 split'
    phaseDetail = 'Coherent path division'
  }

  const shots = Math.round(THREE.MathUtils.lerp(0, 48, range01(p, 0.72, 0.92)))
  const classicalBias = THREE.MathUtils.lerp(12, 840, range01(p, 0.62, 0.84))
  const hybridBias = THREE.MathUtils.lerp(28, 4, range01(p, 0.78, 0.98))
  const mode = p >= 0.88 ? 'LOCKED' : p >= 0.72 ? 'FUSING' : p >= 0.12 ? 'CAI' : 'COOL'

  return {
    phase,
    phaseDetail,
    shots: String(shots),
    classical: `${Math.round(classicalBias)} µg`,
    hybrid: `${Math.round(hybridBias)} µg`,
    mode,
  }
}

// Overdamped on purpose: the readouts settle without ever overshooting past a
// phase boundary and flicking the label back and forth. The IMU bias readout
// covers 828 units across a fifth of the scroll, so undamped it flickers hard.
const TELEMETRY_SPRING = {
  stiffness: 110,
  damping: 30,
  mass: 0.55,
  restDelta: 0.0004,
}

export interface HybridQuantumNavProps {
  scrollProgress?: number
  progress?: MotionValue<number>
  active?: boolean
  className?: string
}

export function HybridQuantumNav({
  scrollProgress = 0,
  progress,
  active = true,
  className = '',
}: HybridQuantumNavProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isVisible = useIntersectionPause(containerRef)
  const reduced = useReducedMotion()
  const progressRef = useMotionProgressRef(progress, scrollProgress)
  const fallbackProgress = useMotionValue(scrollProgress)
  const source = progress ?? fallbackProgress
  // The 3D scene keeps reading the raw value; only the printed numbers are
  // damped, so the readouts stop flickering without the scene going soft.
  const settledSource = useSpring(source, TELEMETRY_SPRING)
  const liveProgress = useThrottledMotionValue(reduced ? source : settledSource, 100)

  useEffect(() => {
    if (!progress) fallbackProgress.set(scrollProgress)
  }, [progress, scrollProgress, fallbackProgress])

  useEffect(() => {
    progressRef.current = progress?.get() ?? scrollProgress
  }, [progress, scrollProgress, progressRef])

  useMotionValueEvent(source, 'change', (value) => {
    progressRef.current = value
  })

  const shownProgress = THREE.MathUtils.clamp(liveProgress, 0, 1)
  const telemetry = getTelemetry(shownProgress)

  return (
    <div ref={containerRef}>
      <ResearchViewerFrame
        className={`${className} research-viewer--qcin`}
        progressPercent={Math.round(shownProgress * 100)}
        telemetry={
          <ViewerTelemetry
            label="Quantum navigation"
            rows={[
              { key: 'Sequence', value: telemetry.phase },
              { key: 'CAI shots', value: telemetry.shots },
              { key: 'IMU bias', value: telemetry.classical },
              { key: 'Hybrid bias', value: telemetry.hybrid },
              { key: 'Filter', value: telemetry.mode },
            ]}
          />
        }
        legend={
          <div className="research-viewer__legend">
            <span className="research-viewer__legend-item research-viewer__legend-item--qcin-atom">
              Matter wave
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--qcin-classical">
              IMU drift
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--qcin-cai">
              CAI update
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--qcin-hybrid">
              Hybrid lock
            </span>
          </div>
        }
      >
        <Canvas
          camera={{ position: [-0.72, 0.2, 4.35], fov: 38, near: 0.1, far: 40 }}
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
            <QcinScene progressRef={progressRef} reduced={reduced} />
          </Suspense>
        </Canvas>
        <div className="qcin-phase" aria-hidden="true">
          <span className="qcin-phase__index">
            {String(Math.min(7, Math.floor(shownProgress * 8)) + 1).padStart(2, '0')}
          </span>
          <span className="qcin-phase__copy">
            <strong>{telemetry.phase}</strong>
            <small>{telemetry.phaseDetail}</small>
          </span>
        </div>
      </ResearchViewerFrame>
    </div>
  )
}
