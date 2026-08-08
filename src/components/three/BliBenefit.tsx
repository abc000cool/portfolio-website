import { Suspense, memo, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMotionValue, useMotionValueEvent, type MotionValue } from 'motion/react'
import * as THREE from 'three'
import { useIntersectionPause } from '../../hooks/useIntersectionPause'
import { useMotionProgressRef } from '../../hooks/useMotionProgressRef'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useThrottledMotionValue } from '../../hooks/useThrottledMotionValue'
import { useDampedReadout } from '../../hooks/useDampedReadout'
import { smoothstep } from '../../lib/airfoilGeometry'
import { MAX_DELTA, approach, hash01, range01 } from '../../lib/viewerMath'
import { ResearchViewerFrame, ViewerTelemetry } from '../research/ResearchViewerFrame'

/**
 * How robust is the BLI benefit? Three beats in one frame: the boundary layer
 * grows along a fuselage and feeds the tail fan; the aircraft dissolves into a
 * Monte-Carlo fleet that condenses onto a response surface with its optimum at
 * 55% ingestion; everything resolves into a distribution with the 0.3-3.7%
 * confidence band. Cyan is aero, amber is energy.
 */

const BL_COLOR = '#4be1ff'
const FAN_COLOR = '#ffb45e'
const FLEET_COLOR = '#94a3b8'
const HOT_COLOR = '#ffd9a8'

const PROGRESS_FOLLOW_RATE = 11
const CAMERA_FOLLOW_RATE = 6.5
const SNAP_RATE = 1e4
const READOUT_RATE = 8

const FUSE_HALF = 1.5
const FAN_X = 1.26
const BL_COUNT = 150
const FLEET_COLS = 22
const FLEET_ROWS = 15
const FLEET_COUNT = FLEET_COLS * FLEET_ROWS
const CURVE_POINTS = 64

/** Ingestion fraction of the interior optimum - the marker's home. */
const OPTIMUM_FRACTION = 0.55

type ProgressRef = React.RefObject<number | null>

function ProgressDriver({
  targetRef,
  sceneRef,
}: {
  targetRef: ProgressRef
  sceneRef: React.RefObject<number>
}) {
  useFrame((_, frameDelta) => {
    const dt = Math.min(frameDelta, MAX_DELTA)
    const target = THREE.MathUtils.clamp(targetRef.current ?? 0, 0, 1)
    sceneRef.current = approach(sceneRef.current, target, PROGRESS_FOLLOW_RATE, dt)
  }, -1)
  return null
}

/** Beat windows shared by every element of the scene. */
function beats(p: number) {
  return {
    skin: smoothstep(range01(p, 0.06, 0.3)),
    fuselage: 1 - smoothstep(range01(p, 0.34, 0.46)),
    fleet: smoothstep(range01(p, 0.34, 0.44)) * (1 - smoothstep(range01(p, 0.56, 0.66))),
    surface: smoothstep(range01(p, 0.5, 0.62)) * (1 - smoothstep(range01(p, 0.72, 0.82))),
    curve: smoothstep(range01(p, 0.72, 0.86)),
    band: smoothstep(range01(p, 0.84, 0.96)),
  }
}

/** Fuselage radius along x in [-FUSE_HALF, FUSE_HALF]: nose, barrel, tail cone. */
function fuselageRadius(x: number): number {
  const u = range01(x, -FUSE_HALF, FUSE_HALF)
  const nose = smoothstep(range01(u, 0, 0.16))
  const tail = 1 - 0.62 * smoothstep(range01(u, 0.68, 0.97))
  return 0.27 * nose * tail
}

/** Boundary-layer thickness: thin at the nose, deep at the tail. */
function blThickness(x: number): number {
  const u = range01(x, -FUSE_HALF, FUSE_HALF)
  return 0.015 + 0.075 * Math.pow(u, 1.4)
}

function CameraRig({ progressRef, reduced }: { progressRef: ProgressRef; reduced: boolean }) {
  const { camera } = useThree()
  const positionRef = useRef(new THREE.Vector3())
  const lookRef = useRef(new THREE.Vector3())
  const targetRef = useRef(new THREE.Vector3())
  const clockRef = useRef(0)
  const primedRef = useRef(false)

  useFrame((_, frameDelta) => {
    const dt = Math.min(frameDelta, MAX_DELTA)
    clockRef.current += dt
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const sweep = smoothstep(range01(p, 0.3, 0.55))
    const settle = smoothstep(range01(p, 0.7, 0.9))

    const t = clockRef.current
    const breathX = reduced ? 0 : Math.sin(t * 0.18) * 0.03
    const breathY = reduced ? 0 : Math.sin(t * 0.14 + 0.6) * 0.02

    const position = positionRef.current
    const target = targetRef.current
    position.set(
      THREE.MathUtils.lerp(-1.15, 0.25, sweep) + settle * -0.15 + breathX,
      THREE.MathUtils.lerp(0.42, 0.85, sweep) - settle * 0.35 + breathY,
      THREE.MathUtils.lerp(4.5, 3.9, sweep) + settle * 0.35,
    )
    target.set(
      THREE.MathUtils.lerp(0.35, 0, sweep),
      THREE.MathUtils.lerp(0, 0.12, sweep) - settle * 0.1,
      0,
    )

    if (!primedRef.current) {
      primedRef.current = true
      camera.position.copy(position)
      lookRef.current.copy(target)
    } else {
      const k = 1 - Math.exp(-CAMERA_FOLLOW_RATE * dt)
      camera.position.lerp(position, k)
      lookRef.current.lerp(target, k)
    }
    camera.lookAt(lookRef.current)
  })

  return null
}

function buildFuselageGeometry(): THREE.LatheGeometry {
  const points: THREE.Vector2[] = []
  const STATIONS = 40
  for (let i = 0; i <= STATIONS; i++) {
    const x = -FUSE_HALF + (i / STATIONS) * FUSE_HALF * 2
    points.push(new THREE.Vector2(Math.max(fuselageRadius(x), 0.001), x))
  }
  return new THREE.LatheGeometry(points, 36)
}

/** Airframe + tail fan ring. The ring is the amber heart of the scene. */
function Fuselage({ progressRef }: { progressRef: ProgressRef }) {
  const bodyMat = useRef<THREE.MeshPhysicalMaterial>(null)
  const ringMat = useRef<THREE.MeshStandardMaterial>(null)
  const discMat = useRef<THREE.MeshBasicMaterial>(null)
  const clockRef = useRef(0)
  const geometry = useMemo(() => buildFuselageGeometry(), [])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, frameDelta) => {
    clockRef.current += Math.min(frameDelta, MAX_DELTA)
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const b = beats(p)
    const arrive = smoothstep(range01(p, 0.0, 0.1))
    const pulse = 0.75 + Math.sin(clockRef.current * 3.6) * 0.25

    // The airframe lingers as a faint ghost through the fleet and surface
    // beats, then clears the stage for the distribution curve.
    const clear = 1 - 0.9 * b.curve
    if (bodyMat.current) {
      bodyMat.current.opacity = arrive * (0.25 + 0.75 * b.fuselage) * clear
    }
    if (ringMat.current) {
      ringMat.current.opacity = arrive * Math.max(b.fuselage, 0.2) * clear
      ringMat.current.emissiveIntensity =
        (1.2 + b.skin * 1.6 * pulse) * Math.max(b.fuselage, 0.2) * clear
    }
    if (discMat.current) {
      discMat.current.opacity = 0.2 * b.skin * b.fuselage * pulse * clear
    }
  })

  return (
    // Lathe revolves around +Y; lay the body along +X with the nose at -X.
    <group rotation={[0, 0, -Math.PI / 2]}>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial
          ref={bodyMat}
          color="#22334d"
          metalness={0.55}
          roughness={0.38}
          clearcoat={0.4}
          transparent
          opacity={0}
        />
      </mesh>
      <group position={[0, FAN_X, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh>
          <torusGeometry args={[0.155, 0.018, 12, 48]} />
          <meshStandardMaterial
            ref={ringMat}
            color={FAN_COLOR}
            emissive={FAN_COLOR}
            emissiveIntensity={1.2}
            transparent
            opacity={0}
            toneMapped={false}
          />
        </mesh>
        <mesh>
          <circleGeometry args={[0.15, 32]} />
          <meshBasicMaterial
            ref={discMat}
            color={BL_COLOR}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  )
}

interface BlSeed {
  phase: number
  speed: number
  phi: number
  lane: number
  size: number
}

/** The luminous particle skin: grows nose-to-tail, streams into the fan. */
function BoundaryLayerSkin({ progressRef }: { progressRef: ProgressRef }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const cyan = useMemo(() => new THREE.Color(BL_COLOR), [])
  const amber = useMemo(() => new THREE.Color(HOT_COLOR), [])
  const clockRef = useRef(0)
  const seeds = useMemo<BlSeed[]>(
    () =>
      Array.from({ length: BL_COUNT }, (_, i) => ({
        phase: hash01(i * 9 + 1),
        speed: 0.06 + hash01(i * 9 + 2) * 0.03,
        phi: hash01(i * 9 + 3) * Math.PI * 2,
        lane: 0.2 + hash01(i * 9 + 4) * 0.8,
        size: 0.7 + hash01(i * 9 + 5) * 0.6,
      })),
    [],
  )

  useFrame((_, frameDelta) => {
    const mesh = meshRef.current
    if (!mesh) return
    // Local clamped clock so a demand-frameloop resume cannot teleport skin.
    const dt = Math.min(frameDelta, MAX_DELTA)
    clockRef.current += dt
    const time = clockRef.current
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const b = beats(p)
    const coverage = b.skin
    const visible = coverage > 0.02 && b.fuselage > 0.05

    for (let i = 0; i < BL_COUNT; i++) {
      const seed = seeds[i]
      if (!seed) continue
      const s = (time * seed.speed + seed.phase) % 1
      // 0..0.82 runs the body; the rest is the jet behind the fan ring.
      const bodyEnd = 0.82
      let x: number
      let radial: number
      let jet = 0
      if (s <= bodyEnd) {
        const u = s / bodyEnd
        // Skin exists only as far down the body as coverage has grown.
        if (u > coverage) {
          dummy.scale.setScalar(0.0001)
          dummy.updateMatrix()
          mesh.setMatrixAt(i, dummy.matrix)
          continue
        }
        x = -FUSE_HALF + u * (FAN_X + FUSE_HALF)
        radial = fuselageRadius(x) + seed.lane * blThickness(x)
      } else {
        jet = (s - bodyEnd) / (1 - bodyEnd)
        x = FAN_X + jet * 0.85
        // Converge onto the fan radius, then hold a tight jet column.
        radial = THREE.MathUtils.lerp(0.15, 0.09, jet) * seed.lane
      }

      const edge = smoothstep(s / 0.06) * smoothstep((1 - s) / 0.1)
      dummy.position.set(x, radial * Math.cos(seed.phi), radial * Math.sin(seed.phi))
      dummy.rotation.set(0, 0, 0)
      const stretch = 1.4 + jet * 2.4
      dummy.scale.set(
        0.03 * seed.size * stretch * edge,
        0.007 * seed.size * edge,
        0.007 * seed.size * edge,
      )
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      color.copy(cyan).lerp(amber, jet)
      mesh.setColorAt(i, color)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    ;(mesh.material as THREE.MeshBasicMaterial).opacity = 0.7 * coverage * b.fuselage
    mesh.visible = visible
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, BL_COUNT]} visible={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0}
        toneMapped={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  )
}

/**
 * The Monte-Carlo fleet doubles as the response surface: the same instances
 * light up in waves as a grid of ghost aircraft, then glide onto the surface
 * heightfield whose ridge peaks at 55% ingestion.
 */
function FleetAndSurface({ progressRef }: { progressRef: ProgressRef }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const markerRef = useRef<THREE.Group>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const base = useMemo(() => new THREE.Color(FLEET_COLOR), [])
  const lit = useMemo(() => new THREE.Color(BL_COLOR), [])
  const clockRef = useRef(0)

  useFrame((_, frameDelta) => {
    const mesh = meshRef.current
    if (!mesh) return
    clockRef.current += Math.min(frameDelta, MAX_DELTA)
    const time = clockRef.current
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const b = beats(p)
    const show = Math.max(b.fleet, b.surface)
    mesh.visible = show > 0.02
    if (markerRef.current) {
      markerRef.current.visible = b.surface > 0.05
      markerRef.current.scale.setScalar(Math.max(b.surface, 0.001))
    }
    if (!mesh.visible) return

    const morph = smoothstep(range01(p, 0.5, 0.62))
    for (let row = 0; row < FLEET_ROWS; row++) {
      for (let col = 0; col < FLEET_COLS; col++) {
        const i = row * FLEET_COLS + col
        const fx = col / (FLEET_COLS - 1)
        const fy = row / (FLEET_ROWS - 1)

        // Grid pose: a wall of ghost aircraft.
        const gridX = -1.55 + fx * 3.1
        const gridY = -0.85 + fy * 1.7
        const gridZ = -0.4

        // Surface pose: benefit vs ingestion fraction, ridge at the optimum.
        const ridge = Math.exp(-Math.pow((fx - OPTIMUM_FRACTION) / 0.24, 2))
        const height = 0.62 * ridge * (0.55 + 0.45 * fy)
        const surfX = -1.2 + fx * 2.4
        const surfY = -0.45 + height
        const surfZ = -0.55 + fy * 1.1

        dummy.position.set(
          THREE.MathUtils.lerp(gridX, surfX, morph),
          THREE.MathUtils.lerp(gridY, surfY, morph),
          THREE.MathUtils.lerp(gridZ, surfZ, morph),
        )
        dummy.rotation.set(0, 0, -Math.PI / 2)
        const jitter = 0.75 + hash01(i * 5 + 7) * 0.5
        dummy.scale.setScalar(show * jitter * THREE.MathUtils.lerp(1, 0.55, morph))
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)

        // Light-up wave sweeps diagonally across the fleet; on the surface the
        // ridge itself carries the brightness.
        const wave =
          0.25 +
          0.75 *
            Math.max(
              0,
              Math.sin((fx + fy) * 5.2 - time * 2.6 + hash01(i * 11 + 3) * 0.8),
            )
        const glow = THREE.MathUtils.lerp(wave, 0.3 + ridge, morph)
        color.copy(base).lerp(lit, glow)
        mesh.setColorAt(i, color)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    ;(mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * show
  })

  const markerX = -1.2 + OPTIMUM_FRACTION * 2.4

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, FLEET_COUNT]} visible={false}>
        <coneGeometry args={[0.022, 0.07, 5]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
      <group ref={markerRef} visible={false}>
        <mesh position={[markerX, 0.32, 0]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial
            color={FAN_COLOR}
            emissive={FAN_COLOR}
            emissiveIntensity={2.2}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[markerX, -0.05, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.72, 6]} />
          <meshBasicMaterial
            color={FAN_COLOR}
            transparent
            opacity={0.6}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  )
}

/** Right-skewed benefit distribution, drawn in light, sampled once. */
const distribution = (() => {
  const ys = new Float32Array(CURVE_POINTS)
  let max = 0
  for (let i = 0; i < CURVE_POINTS; i++) {
    const fuel = (i / (CURVE_POINTS - 1)) * 4.4 + 0.01
    const y = Math.exp(-Math.pow(Math.log(fuel / 1.55), 2) / (2 * 0.62 * 0.62))
    ys[i] = y
    max = Math.max(max, y)
  }
  for (let i = 0; i < CURVE_POINTS; i++) ys[i] /= max
  return ys
})()

const fuelToX = (fuel: number) => -1.2 + (fuel / 4.4) * 2.4

/** Final beat: the distribution curve and its 0.3-3.7% confidence band. */
function BenefitDistribution({ progressRef }: { progressRef: ProgressRef }) {
  const groupRef = useRef<THREE.Group>(null)
  const bandRef = useRef<THREE.Mesh>(null)
  const axisMat = useRef<THREE.LineBasicMaterial>(null)

  const curveGeometry = useMemo(() => {
    const positions = new Float32Array(CURVE_POINTS * 3)
    for (let i = 0; i < CURVE_POINTS; i++) {
      positions[i * 3] = -1.2 + (i / (CURVE_POINTS - 1)) * 2.4
      positions[i * 3 + 1] = -0.42 + distribution[i] * 0.95
      positions[i * 3 + 2] = 0
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setDrawRange(0, 0)
    return geo
  }, [])

  // Material attaches via JSX so per-frame mutation goes through a ref,
  // never the memoized line object.
  const curveLine = useMemo(() => new THREE.Line(curveGeometry), [curveGeometry])
  const curveMatRef = useRef<THREE.LineBasicMaterial>(null)

  const bandGeometry = useMemo(() => {
    // Area under the curve between 0.3% and 3.7% fuel saved.
    const lo = 0.3
    const hi = 3.7
    const verts: number[] = []
    const index: number[] = []
    let quad = 0
    for (let i = 0; i < CURVE_POINTS - 1; i++) {
      const fuel = (i / (CURVE_POINTS - 1)) * 4.4
      if (fuel < lo || fuel > hi) continue
      const x0 = -1.2 + (i / (CURVE_POINTS - 1)) * 2.4
      const x1 = -1.2 + ((i + 1) / (CURVE_POINTS - 1)) * 2.4
      const y0 = -0.42 + distribution[i] * 0.95
      const y1 = -0.42 + distribution[i + 1] * 0.95
      verts.push(x0, -0.42, -0.002, x0, y0, -0.002, x1, -0.42, -0.002, x1, y1, -0.002)
      const a = quad * 4
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      quad++
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    geo.setIndex(index)
    return geo
  }, [])

  const axisGeometry = useMemo(() => {
    const pts = [
      -1.3, -0.42, 0, 1.3, -0.42, 0,
      fuelToX(0.3), -0.42, 0, fuelToX(0.3), -0.36, 0,
      fuelToX(3.7), -0.42, 0, fuelToX(3.7), -0.36, 0,
    ]
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return geo
  }, [])

  useEffect(() => {
    return () => {
      curveGeometry.dispose()
      bandGeometry.dispose()
      axisGeometry.dispose()
    }
  }, [curveGeometry, bandGeometry, axisGeometry])

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const b = beats(p)
    group.visible = b.curve > 0.02
    if (!group.visible) return

    curveGeometry.setDrawRange(0, Math.max(2, Math.round(CURVE_POINTS * b.curve)))
    if (curveMatRef.current) curveMatRef.current.opacity = 0.95 * b.curve
    if (bandRef.current) {
      ;(bandRef.current.material as THREE.MeshBasicMaterial).opacity = 0.2 * b.band
    }
    if (axisMat.current) axisMat.current.opacity = 0.55 * b.curve
  })

  return (
    <group ref={groupRef} position={[0, 0.05, 0.4]} visible={false}>
      <primitive object={curveLine}>
        <lineBasicMaterial
          ref={curveMatRef}
          attach="material"
          color={BL_COLOR}
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </primitive>
      <mesh ref={bandRef} geometry={bandGeometry}>
        <meshBasicMaterial
          color={FAN_COLOR}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <lineSegments geometry={axisGeometry}>
        <lineBasicMaterial
          ref={axisMat}
          color="#94a3b8"
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  )
}

const BliScene = memo(function BliScene({
  scrollTargetRef,
  sceneProgressRef,
  reduced,
}: {
  scrollTargetRef: ProgressRef
  sceneProgressRef: React.RefObject<number>
  reduced: boolean
}) {
  return (
    <>
      <ProgressDriver targetRef={scrollTargetRef} sceneRef={sceneProgressRef} />
      <color attach="background" args={['#05070a']} />
      <fog attach="fog" args={['#05070a', 7, 12]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 5]} intensity={1.5} color="#e2e8f0" />
      <pointLight position={[1.4, 0.3, 1.6]} intensity={0.9} color={FAN_COLOR} distance={5} />
      <pointLight position={[-1.6, 0.5, 1.8]} intensity={0.6} color={BL_COLOR} distance={6} />
      <CameraRig progressRef={sceneProgressRef} reduced={reduced} />
      <Fuselage progressRef={sceneProgressRef} />
      <BoundaryLayerSkin progressRef={sceneProgressRef} />
      <FleetAndSurface progressRef={sceneProgressRef} />
      <BenefitDistribution progressRef={sceneProgressRef} />
    </>
  )
})

function getTelemetry(progress: number) {
  const p = THREE.MathUtils.clamp(progress, 0, 1)
  let phase = 'Power balance'
  let phaseDetail = 'The exact energy ledger, open-sourced'
  let index = 1
  if (p >= 0.74) {
    phase = 'Error bars'
    phaseDetail = '0.3–3.7% fuel saved · 90% confidence'
    index = 5
  } else if (p >= 0.5) {
    phase = 'Response surface'
    phaseDetail = 'Interior optimum near 55% ingestion'
    index = 4
  } else if (p >= 0.34) {
    phase = 'Monte-Carlo'
    phaseDetail = '147,456 evaluations light up'
    index = 3
  } else if (p >= 0.08) {
    phase = 'Boundary layer'
    phaseDetail = 'Slow air swallowed at the tail'
    index = 2
  }

  const evalT = smoothstep(range01(p, 0.36, 0.62))
  const bandT = smoothstep(range01(p, 0.78, 0.94))
  return {
    phase,
    phaseDetail,
    index,
    evals: evalT > 0 ? Math.round(147456 * evalT).toLocaleString('en-US') : '—',
    optimum: p >= 0.52 ? '55% ingest' : '—',
    fuel: bandT > 0 ? `${(0.3 * bandT).toFixed(1)}–${(3.7 * bandT).toFixed(1)}%` : '—',
    valid: 'D8 · STARC-ABL',
  }
}

export interface BliBenefitProps {
  scrollProgress?: number
  progress?: MotionValue<number>
  active?: boolean
  className?: string
}

export function BliBenefit({
  scrollProgress = 0,
  progress,
  active = true,
  className = '',
}: BliBenefitProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isVisible = useIntersectionPause(containerRef)
  const progressRef = useMotionProgressRef(progress, scrollProgress)
  const sceneProgressRef = useRef(scrollProgress)
  const primedRef = useRef(false)
  const fallbackProgress = useMotionValue(scrollProgress)
  const source = progress ?? fallbackProgress
  const liveProgress = useThrottledMotionValue(source, 100)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!progress) fallbackProgress.set(scrollProgress)
  }, [progress, scrollProgress, fallbackProgress])

  useEffect(() => {
    const value = progress?.get() ?? scrollProgress
    progressRef.current = value
    if (!primedRef.current) {
      primedRef.current = true
      sceneProgressRef.current = value
    }
  }, [progress, scrollProgress, progressRef])

  useMotionValueEvent(source, 'change', (value) => {
    progressRef.current = value
  })

  const shownProgress = useDampedReadout(liveProgress, reduced ? SNAP_RATE : READOUT_RATE)
  const telemetry = getTelemetry(shownProgress)

  return (
    <div ref={containerRef}>
      <ResearchViewerFrame
        className={`${className} research-viewer--bli`}
        progressPercent={Math.round(shownProgress * 100)}
        telemetry={
          <ViewerTelemetry
            label="BLI benefit"
            rows={[
              { key: 'Phase', value: telemetry.phase },
              { key: 'Evals', value: telemetry.evals },
              { key: 'Optimum', value: telemetry.optimum },
              { key: 'Fuel', value: telemetry.fuel },
              { key: 'Valid', value: telemetry.valid },
            ]}
          />
        }
        legend={
          <div className="research-viewer__legend">
            <span className="research-viewer__legend-item research-viewer__legend-item--bli-bl">
              Boundary layer
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--bli-fan">
              Fan · energy
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--bli-fleet">
              Monte-Carlo fleet
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--bli-band">
              Confidence band
            </span>
          </div>
        }
      >
        <Canvas
          camera={{ position: [-1.15, 0.42, 4.5], fov: 38, near: 0.1, far: 40 }}
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
            <BliScene
              scrollTargetRef={progressRef}
              sceneProgressRef={sceneProgressRef}
              reduced={reduced}
            />
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
