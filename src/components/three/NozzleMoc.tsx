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
 * nozzlemoc - the Method of Characteristics as a picture: a wireframe bell
 * draws itself in nose-to-exit, then the two crossing families of
 * characteristic lines sweep the diverging section. Waves are lines.
 */

const BELL_COLOR = '#67e8f9'
const HOOP_COLOR = '#22d3ee'
const CPLUS_COLOR = '#a5f3fc'
const CMINUS_COLOR = '#ffb454'
const SONIC_COLOR = '#ffb454'
const FLOW_COLOR = '#67e8f9'

const PROGRESS_FOLLOW_RATE = 11
const CAMERA_FOLLOW_RATE = 6.5
const SNAP_RATE = 1e4
const READOUT_RATE = 8

/** Throat sits at x = 0; the flow runs toward +X. */
const X_INLET = -0.65
const X_EXIT = 2.3
const R_THROAT = 0.3
const R_CHAMBER = 0.58
const R_EXIT = 1.0

const MERIDIAN_COUNT = 14
const MERIDIAN_STATIONS = 44
const HOOP_COUNT = 18
const HOOP_SEGMENTS = 40
const CHAR_CURVES = 10
const FLOW_COUNT = 80

type ProgressRef = React.RefObject<number | null>

/**
 * Rao-style bell approximation: quadratic Bezier from the throat lip to the
 * exit lip. Control point is the intersection of the 32-degree initial-angle
 * line with the 8-degree exit-angle line - the classical parabola construction.
 */
const BELL_P1_X = 0.7875
const BELL_P1_R = 0.7883

const RADIUS_SAMPLES = 256
const radiusLut = (() => {
  const lut = new Float32Array(RADIUS_SAMPLES)
  for (let i = 0; i < RADIUS_SAMPLES; i++) {
    const x = X_INLET + ((X_EXIT - X_INLET) * i) / (RADIUS_SAMPLES - 1)
    if (x <= 0) {
      lut[i] = R_THROAT + (R_CHAMBER - R_THROAT) * smoothstep(-x / -X_INLET)
    } else {
      // Invert the Bezier x(t) for this station by bisection - done once, at
      // module load, so the per-frame paths below can stay lookups.
      let lo = 0
      let hi = 1
      for (let iter = 0; iter < 24; iter++) {
        const mid = (lo + hi) / 2
        const bx =
          (1 - mid) * (1 - mid) * 0 + 2 * (1 - mid) * mid * BELL_P1_X + mid * mid * X_EXIT
        if (bx < x) lo = mid
        else hi = mid
      }
      const t = (lo + hi) / 2
      lut[i] =
        (1 - t) * (1 - t) * R_THROAT + 2 * (1 - t) * t * BELL_P1_R + t * t * R_EXIT
    }
  }
  return lut
})()

function bellRadius(x: number): number {
  const f = THREE.MathUtils.clamp((x - X_INLET) / (X_EXIT - X_INLET), 0, 1) * (RADIUS_SAMPLES - 1)
  const i = Math.min(Math.floor(f), RADIUS_SAMPLES - 2)
  return THREE.MathUtils.lerp(radiusLut[i], radiusLut[i + 1], f - i)
}

/** Mach angle proxy: steep at the throat, shallow at the exit. */
function machAngle(x: number): number {
  return THREE.MathUtils.degToRad(THREE.MathUtils.lerp(62, 16, smoothstep(x / X_EXIT)))
}

interface RevealGeometry {
  geometry: THREE.BufferGeometry
  /** Total vertex count - drawRange animates toward this. */
  total: number
}

function segmentsFromPoints(points: number[]): RevealGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  geometry.setDrawRange(0, 0)
  return { geometry, total: points.length / 3 }
}

/**
 * Segments ordered station-by-station (not meridian-by-meridian) so a single
 * drawRange sweep draws every meridian in lockstep from inlet to exit - the
 * bell "draws itself in" rather than appearing one rib at a time.
 */
function buildMeridians(): RevealGeometry {
  const points: number[] = []
  for (let s = 0; s < MERIDIAN_STATIONS - 1; s++) {
    const x0 = X_INLET + ((X_EXIT - X_INLET) * s) / (MERIDIAN_STATIONS - 1)
    const x1 = X_INLET + ((X_EXIT - X_INLET) * (s + 1)) / (MERIDIAN_STATIONS - 1)
    const r0 = bellRadius(x0)
    const r1 = bellRadius(x1)
    for (let m = 0; m < MERIDIAN_COUNT; m++) {
      const phi = (m / MERIDIAN_COUNT) * Math.PI * 2
      points.push(x0, r0 * Math.cos(phi), r0 * Math.sin(phi))
      points.push(x1, r1 * Math.cos(phi), r1 * Math.sin(phi))
    }
  }
  return segmentsFromPoints(points)
}

function buildHoops(): RevealGeometry {
  const points: number[] = []
  for (let h = 0; h < HOOP_COUNT; h++) {
    // Denser rings near the throat, where the contour turns fastest.
    const f = h / (HOOP_COUNT - 1)
    const x = X_INLET + (X_EXIT - X_INLET) * f * f * (3 - 2 * f)
    const r = bellRadius(x)
    for (let s = 0; s < HOOP_SEGMENTS; s++) {
      const a0 = (s / HOOP_SEGMENTS) * Math.PI * 2
      const a1 = ((s + 1) / HOOP_SEGMENTS) * Math.PI * 2
      points.push(x, r * Math.cos(a0), r * Math.sin(a0))
      points.push(x, r * Math.cos(a1), r * Math.sin(a1))
    }
  }
  return segmentsFromPoints(points)
}

/**
 * One family of characteristics in the z = 0 cutaway plane. Rising curves
 * start on the lower wall and march downstream at the local Mach angle until
 * they meet the upper wall; `sign` = -1 mirrors the family. Curves are
 * concatenated in launch order so drawRange sweeps the mesh downstream.
 */
function buildCharacteristics(sign: 1 | -1): RevealGeometry {
  const points: number[] = []
  const dx = 0.045
  for (let k = 0; k < CHAR_CURVES; k++) {
    const x0 = 0.05 + (k / (CHAR_CURVES - 1)) * 1.55
    let x = x0
    let y = -sign * bellRadius(x0)
    for (let step = 0; step < 120; step++) {
      const nx = x + dx
      const ny = y + sign * Math.tan(machAngle(x)) * dx
      if (nx > X_EXIT - 0.02) break
      const wall = bellRadius(nx)
      const clippedY = THREE.MathUtils.clamp(ny, -wall, wall)
      points.push(x, y, 0, nx, clippedY, 0)
      x = nx
      y = clippedY
      if (sign > 0 ? y >= wall : y <= -wall) break
    }
  }
  return segmentsFromPoints(points)
}

/**
 * Single owner of the progress the scene is drawn at - everything downstream
 * reads the damped ref, never raw scroll. Priority -1 so it publishes before
 * any consumer reads it.
 */
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

function CameraRig({ progressRef, reduced }: { progressRef: ProgressRef; reduced: boolean }) {
  const { camera } = useThree()
  const positionRef = useRef(new THREE.Vector3())
  const targetRef = useRef(new THREE.Vector3())
  const lookRef = useRef(new THREE.Vector3())
  const clockRef = useRef(0)
  const primedRef = useRef(false)

  useFrame((_, frameDelta) => {
    const dt = Math.min(frameDelta, MAX_DELTA)
    clockRef.current += dt
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const push = smoothstep(range01(p, 0.16, 0.4))
    const settle = smoothstep(range01(p, 0.72, 0.9))
    const position = positionRef.current
    const target = targetRef.current

    const t = clockRef.current
    const breathX = reduced ? 0 : Math.sin(t * 0.17) * 0.03
    const breathY = reduced ? 0 : Math.sin(t * 0.13 + 0.7) * 0.02

    position.set(
      THREE.MathUtils.lerp(-1.5, 0.8, push) - settle * 0.5 + breathX,
      THREE.MathUtils.lerp(0.75, 0.4, push) + settle * 0.5 + breathY,
      THREE.MathUtils.lerp(4.7, 3.55, push) + settle * 1.3,
    )
    target.set(
      THREE.MathUtils.lerp(0.55, 0.95, push) - settle * 0.15,
      0,
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

/** The wireframe shell. Rotates slowly about its own axis while in view. */
function BellShell({ progressRef, reduced }: { progressRef: ProgressRef; reduced: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const meridians = useMemo(() => buildMeridians(), [])
  const hoops = useMemo(() => buildHoops(), [])
  const meridianMat = useRef<THREE.LineBasicMaterial>(null)
  const hoopMat = useRef<THREE.LineBasicMaterial>(null)

  useEffect(() => {
    const m = meridians.geometry
    const h = hoops.geometry
    return () => {
      m.dispose()
      h.dispose()
    }
  }, [meridians, hoops])

  useFrame((_, frameDelta) => {
    const dt = Math.min(frameDelta, MAX_DELTA)
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const reveal = smoothstep(range01(p, 0.01, 0.12))

    // Draw ranges must land on segment (2-vertex) boundaries or lines tear.
    meridians.geometry.setDrawRange(0, Math.floor((meridians.total * reveal) / 2) * 2)
    hoops.geometry.setDrawRange(0, Math.floor((hoops.total * reveal) / 2) * 2)

    if (meridianMat.current) meridianMat.current.opacity = 0.28 + 0.5 * reveal
    if (hoopMat.current) hoopMat.current.opacity = 0.16 + 0.24 * reveal

    if (groupRef.current && !reduced) {
      groupRef.current.rotation.x += dt * 0.16
    }
  })

  return (
    <group ref={groupRef}>
      <lineSegments geometry={meridians.geometry}>
        <lineBasicMaterial
          ref={meridianMat}
          color={BELL_COLOR}
          transparent
          opacity={0}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      <lineSegments geometry={hoops.geometry}>
        <lineBasicMaterial
          ref={hoopMat}
          color={HOOP_COLOR}
          transparent
          opacity={0}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  )
}

/** Pulsing amber ring at x = 0 - the sonic line, where the method starts. */
function SonicLine({ progressRef }: { progressRef: ProgressRef }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const clockRef = useRef(0)

  useFrame((_, frameDelta) => {
    const mesh = meshRef.current
    if (!mesh) return
    clockRef.current += Math.min(frameDelta, MAX_DELTA)
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const reveal = smoothstep(range01(p, 0.0, 0.04))
    const pulse = 0.7 + Math.sin(clockRef.current * 4.4) * 0.3
    mesh.visible = reveal > 0.02
    const material = mesh.material as THREE.MeshStandardMaterial
    material.opacity = reveal * 0.9
    material.emissiveIntensity = (1.4 + pulse * 1.4) * reveal
  })

  return (
    <mesh ref={meshRef} rotation={[0, Math.PI / 2, 0]} visible={false}>
      <torusGeometry args={[R_THROAT, 0.012, 10, 48]} />
      <meshStandardMaterial
        color={SONIC_COLOR}
        emissive={SONIC_COLOR}
        emissiveIntensity={2}
        transparent
        opacity={0}
        toneMapped={false}
      />
    </mesh>
  )
}

/** Both characteristic families, swept downstream slightly out of phase. */
function CharacteristicMesh({ progressRef }: { progressRef: ProgressRef }) {
  const plus = useMemo(() => buildCharacteristics(1), [])
  const minus = useMemo(() => buildCharacteristics(-1), [])
  const plusMat = useRef<THREE.LineBasicMaterial>(null)
  const minusMat = useRef<THREE.LineBasicMaterial>(null)
  const clockRef = useRef(0)

  useEffect(() => {
    const a = plus.geometry
    const b = minus.geometry
    return () => {
      a.dispose()
      b.dispose()
    }
  }, [plus, minus])

  useFrame((_, frameDelta) => {
    clockRef.current += Math.min(frameDelta, MAX_DELTA)
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const plusReveal = smoothstep(range01(p, 0.14, 0.34))
    const minusReveal = smoothstep(range01(p, 0.18, 0.38))
    // The mesh stays as the reference frame the rest of the story sits on;
    // it only dims slightly once the benchmark beat takes over.
    const recede = 1 - 0.35 * smoothstep(range01(p, 0.76, 0.88))
    const shimmer = 1 + Math.sin(clockRef.current * 2.1) * 0.08

    plus.geometry.setDrawRange(0, Math.floor((plus.total * plusReveal) / 2) * 2)
    minus.geometry.setDrawRange(0, Math.floor((minus.total * minusReveal) / 2) * 2)
    if (plusMat.current) plusMat.current.opacity = 0.72 * plusReveal * recede * shimmer
    if (minusMat.current) minusMat.current.opacity = 0.55 * minusReveal * recede * shimmer
  })

  return (
    <group>
      <lineSegments geometry={plus.geometry}>
        <lineBasicMaterial
          ref={plusMat}
          color={CPLUS_COLOR}
          transparent
          opacity={0}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
      <lineSegments geometry={minus.geometry}>
        <lineBasicMaterial
          ref={minusMat}
          color={CMINUS_COLOR}
          transparent
          opacity={0}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  )
}

interface FlowSeed {
  lane: number
  phi: number
  phase: number
  speed: number
  size: number
}

/** Streaks accelerating through the throat - the flow the mesh describes. */
function FlowStream({ progressRef }: { progressRef: ProgressRef }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const clockRef = useRef(0)
  const seeds = useMemo<FlowSeed[]>(
    () =>
      Array.from({ length: FLOW_COUNT }, (_, i) => ({
        lane: 0.12 + hash01(i * 7 + 1) * 0.72,
        phi: hash01(i * 7 + 2) * Math.PI * 2,
        phase: hash01(i * 7 + 3),
        speed: 0.085 + hash01(i * 7 + 4) * 0.035,
        size: 0.7 + hash01(i * 7 + 5) * 0.6,
      })),
    [],
  )

  useFrame((_, frameDelta) => {
    const mesh = meshRef.current
    if (!mesh) return
    // Local clamped clock: a demand-frameloop resume must not teleport streaks.
    const dt = Math.min(frameDelta, MAX_DELTA)
    clockRef.current += dt
    const time = clockRef.current
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const reveal = smoothstep(range01(p, 0.36, 0.5))

    for (let i = 0; i < FLOW_COUNT; i++) {
      const seed = seeds[i]
      if (!seed) continue
      const s = (time * seed.speed + seed.phase) % 1
      // Constant ds with x ~ s^0.7 stretches spacing downstream - the visual
      // acceleration through the throat without integrating a speed profile.
      const x = X_INLET + (X_EXIT - X_INLET + 0.55) * Math.pow(s, 0.7)
      const r = seed.lane * bellRadius(Math.min(x, X_EXIT))
      const edge = smoothstep(s / 0.08) * smoothstep((1 - s) / 0.08)
      const stretch = 0.7 + Math.pow(s, 0.7) * 2.2

      dummy.position.set(x, r * Math.cos(seed.phi), r * Math.sin(seed.phi))
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(0.05 * seed.size * stretch * edge, 0.008 * seed.size * edge, 0.008 * seed.size * edge)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    ;(mesh.material as THREE.MeshBasicMaterial).opacity = reveal * 0.55
    mesh.visible = reveal > 0.02
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, FLOW_COUNT]} visible={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial
        color={FLOW_COLOR}
        transparent
        opacity={0}
        toneMapped={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  )
}

const NozzleScene = memo(function NozzleScene({
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
      <color attach="background" args={['#04070c']} />
      <fog attach="fog" args={['#04070c', 7, 12]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 5]} intensity={1.1} color="#e0f2fe" />
      <pointLight position={[0, 0.4, 2.2]} intensity={0.8} color="#67e8f9" distance={6} />
      <pointLight position={[0.1, -0.6, -1.8]} intensity={0.5} color="#ffb454" distance={5} />
      <CameraRig progressRef={sceneProgressRef} reduced={reduced} />
      <group position={[-0.85, 0, 0]}>
        <BellShell progressRef={sceneProgressRef} reduced={reduced} />
        <SonicLine progressRef={sceneProgressRef} />
        <CharacteristicMesh progressRef={sceneProgressRef} />
        <FlowStream progressRef={sceneProgressRef} />
      </group>
    </>
  )
})

function getTelemetry(progress: number) {
  const p = THREE.MathUtils.clamp(progress, 0, 1)
  let phase = 'Sonic line'
  let phaseDetail = 'Flow chokes at the throat'
  let index = 1
  if (p >= 0.74) {
    phase = 'Pareto atlas'
    phaseDetail = '8,192 coupled sims · θmax/ν → 0.550'
    index = 5
  } else if (p >= 0.48) {
    phase = 'Benchmarks'
    phaseDetail = '0.011% vs textbook · 1952 NACA Mach-10'
    index = 4
  } else if (p >= 0.14) {
    phase = 'Characteristics'
    phaseDetail = 'Two wave families sweep the interior'
    index = 3
  } else if (p >= 0.03) {
    phase = 'Bell contour'
    phaseDetail = 'The nozzle draws itself in'
    index = 2
  }

  const benchT = smoothstep(range01(p, 0.48, 0.64))
  const yearT = smoothstep(range01(p, 0.52, 0.68))
  const ratioT = smoothstep(range01(p, 0.74, 0.86))
  const simsT = smoothstep(range01(p, 0.76, 0.9))
  return {
    phase,
    phaseDetail,
    index,
    bench: benchT > 0 ? `${(0.011 * benchT).toFixed(3)}%` : '—',
    year: yearT > 0 ? String(Math.round(THREE.MathUtils.lerp(1900, 1952, yearT))) : '—',
    ratio: ratioT > 0 ? (0.55 * ratioT).toFixed(3) : '—',
    sims: simsT > 0 ? Math.round(8192 * simsT).toLocaleString('en-US') : '—',
  }
}

export interface NozzleMocProps {
  scrollProgress?: number
  progress?: MotionValue<number>
  active?: boolean
  className?: string
}

export function NozzleMoc({
  scrollProgress = 0,
  progress,
  active = true,
  className = '',
}: NozzleMocProps) {
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
        className={`${className} research-viewer--nozzlemoc`}
        progressPercent={Math.round(shownProgress * 100)}
        telemetry={
          <ViewerTelemetry
            label="nozzlemoc"
            rows={[
              { key: 'Phase', value: telemetry.phase },
              { key: 'vs text', value: telemetry.bench },
              { key: 'NACA', value: telemetry.year },
              { key: 'θmax/ν', value: telemetry.ratio },
              { key: 'Sims', value: telemetry.sims },
            ]}
          />
        }
        legend={
          <div className="research-viewer__legend">
            <span className="research-viewer__legend-item research-viewer__legend-item--noz-bell">
              Bell contour
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--noz-cplus">
              C⁺ waves
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--noz-cminus">
              C⁻ waves
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--noz-sonic">
              Sonic line
            </span>
          </div>
        }
      >
        <Canvas
          camera={{ position: [-1.5, 0.75, 4.7], fov: 38, near: 0.1, far: 40 }}
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
            <NozzleScene
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
