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
 * The RDE wave-count atlas in four beats: an annulus where one ember front
 * splits into four; the ring unrolls into a 1D sawtooth strip; the strip
 * dissolves into the two-parameter regime map - the staircase; the atlas
 * recedes under the closing counters. The detonation fronts are the only
 * truly bright thing on screen.
 */

const FRONT_COLOR = '#ff7a29'
const CORE_COLOR = '#ff3300'
const GALLOP_COLOR = '#33e0ff'

const PROGRESS_FOLLOW_RATE = 11
const CAMERA_FOLLOW_RATE = 6.5
const SNAP_RATE = 1e4
const READOUT_RATE = 8

const RING_RADIUS = 1.05
const TRAIL_PER_FRONT = 22
const STRIP_POINTS = 220
const STRIP_WAVES = 4
const ATLAS_COLS = 26
const ATLAS_ROWS = 16
const ATLAS_COUNT = ATLAS_COLS * ATLAS_ROWS

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

/** Continuous wave count: 1 front splits smoothly into 4 across beat one. */
function waveCount(p: number): number {
  return 1 + 3 * smoothstep(range01(p, 0.05, 0.26))
}

function beats(p: number) {
  return {
    ring: 1 - smoothstep(range01(p, 0.3, 0.42)),
    strip: smoothstep(range01(p, 0.32, 0.42)) * (1 - smoothstep(range01(p, 0.56, 0.66))),
    atlas: smoothstep(range01(p, 0.56, 0.68)),
    finale: smoothstep(range01(p, 0.85, 0.96)),
  }
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
    const unroll = smoothstep(range01(p, 0.3, 0.45))
    const flat = smoothstep(range01(p, 0.56, 0.7))
    const back = smoothstep(range01(p, 0.85, 0.97))

    const t = clockRef.current
    const breathX = reduced ? 0 : Math.sin(t * 0.16) * 0.03
    const breathY = reduced ? 0 : Math.sin(t * 0.12 + 0.5) * 0.02

    const position = positionRef.current
    const target = targetRef.current
    position.set(
      breathX,
      THREE.MathUtils.lerp(1.7, 0.35, unroll) + flat * -0.05 + breathY,
      THREE.MathUtils.lerp(4.4, 4.1, unroll) + flat * 0.3 + back * 0.7,
    )
    target.set(0, THREE.MathUtils.lerp(0.1, 0, unroll), 0)

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

/** Beat one: the tilted annulus and its racing, splitting fronts. */
function DetonationRing({ progressRef }: { progressRef: ProgressRef }) {
  const groupRef = useRef<THREE.Group>(null)
  const annulusMat = useRef<THREE.MeshStandardMaterial>(null)
  const frontsRef = useRef<THREE.InstancedMesh>(null)
  const trailsRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const frontColor = useMemo(() => new THREE.Color(FRONT_COLOR), [])
  const coreColor = useMemo(() => new THREE.Color(CORE_COLOR), [])
  const darkColor = useMemo(() => new THREE.Color('#1a0d06'), [])
  const clockRef = useRef(0)
  const angleRef = useRef(0)

  useFrame((_, frameDelta) => {
    const group = groupRef.current
    const fronts = frontsRef.current
    const trails = trailsRef.current
    if (!group || !fronts || !trails) return
    // Local clamped clock: a demand-frameloop wake must not teleport fronts.
    const dt = Math.min(frameDelta, MAX_DELTA)
    clockRef.current += dt
    const time = clockRef.current
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const b = beats(p)
    const n = waveCount(p)

    group.visible = b.ring > 0.02
    if (!group.visible) return
    group.scale.setScalar(THREE.MathUtils.lerp(0.6, 1, b.ring))

    // Fronts speed up as the engine locks more of them in.
    angleRef.current += dt * (0.55 + 0.22 * (n - 1))
    const head = angleRef.current

    const arrive = smoothstep(range01(p, 0.0, 0.08))
    if (annulusMat.current) annulusMat.current.opacity = arrive * b.ring

    // Fronts ride the face of the tube nearest the camera; on the centerline
    // they sat inside the opaque torus and were depth-culled invisible.
    const LIFT = 0.13
    for (let k = 0; k < 4; k++) {
      // Front k fades in as the continuous count n passes it, and spreads to
      // its evenly-spaced slot as the split completes.
      const alive = THREE.MathUtils.clamp(n - k, 0, 1)
      const angle = head + (k * Math.PI * 2) / Math.max(n, 1)
      const pulse = 0.8 + Math.sin(time * 9 + k * 1.7) * 0.2

      dummy.position.set(Math.cos(angle) * RING_RADIUS, Math.sin(angle) * RING_RADIUS, LIFT)
      dummy.rotation.set(0, 0, angle + Math.PI / 2)
      dummy.scale.set(
        0.16 * alive * pulse,
        0.055 * alive * pulse,
        0.055 * alive * pulse,
      )
      dummy.updateMatrix()
      fronts.setMatrixAt(k, dummy.matrix)
      color.copy(coreColor).lerp(frontColor, 0.35 + 0.35 * Math.sin(time * 7 + k))
      fronts.setColorAt(k, color)

      // Decaying heat trail behind each front.
      for (let j = 0; j < TRAIL_PER_FRONT; j++) {
        const i = k * TRAIL_PER_FRONT + j
        const back = angle - (j + 1) * 0.075
        const fade = (1 - j / TRAIL_PER_FRONT) * alive
        dummy.position.set(Math.cos(back) * RING_RADIUS, Math.sin(back) * RING_RADIUS, LIFT)
        dummy.rotation.set(0, 0, back + Math.PI / 2)
        dummy.scale.set(0.11 * fade + 0.001, 0.04 * fade + 0.001, 0.04 * fade + 0.001)
        dummy.updateMatrix()
        trails.setMatrixAt(i, dummy.matrix)
        color.copy(frontColor).lerp(darkColor, 1 - fade * fade)
        trails.setColorAt(i, color)
      }
    }
    fronts.instanceMatrix.needsUpdate = true
    if (fronts.instanceColor) fronts.instanceColor.needsUpdate = true
    trails.instanceMatrix.needsUpdate = true
    if (trails.instanceColor) trails.instanceColor.needsUpdate = true
    ;(fronts.material as THREE.MeshBasicMaterial).opacity = b.ring
    ;(trails.material as THREE.MeshBasicMaterial).opacity = 0.8 * b.ring
  })

  return (
    // Slight tilt so the annulus reads as a combustor, not a circle.
    <group ref={groupRef} rotation={[-1.05, 0, 0]}>
      <mesh>
        <torusGeometry args={[RING_RADIUS, 0.15, 14, 72]} />
        <meshStandardMaterial
          ref={annulusMat}
          color="#241b14"
          emissive="#20100a"
          emissiveIntensity={0.8}
          metalness={0.55}
          roughness={0.5}
          transparent
          opacity={0}
        />
      </mesh>
      <instancedMesh ref={frontsRef} args={[undefined, undefined, 4]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
      <instancedMesh ref={trailsRef} args={[undefined, undefined, 4 * TRAIL_PER_FRONT]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </group>
  )
}

/** Beat two: the annulus unrolled onto a line - N sawtooth pulses. */
function UnrolledStrip({ progressRef }: { progressRef: ProgressRef }) {
  const groupRef = useRef<THREE.Group>(null)
  const peaksRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const clockRef = useRef(0)
  const front = useMemo(() => new THREE.Color(FRONT_COLOR), [])
  const core = useMemo(() => new THREE.Color(CORE_COLOR), [])
  const refill = useMemo(() => new THREE.Color('#3a2418'), [])
  const scratch = useMemo(() => new THREE.Color(), [])

  const stripGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(STRIP_POINTS * 3), 3),
    )
    geo.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(new Float32Array(STRIP_POINTS * 3), 3),
    )
    return geo
  }, [])

  // Material attaches via JSX so per-frame mutation goes through a ref,
  // never the memoized line object.
  const stripLine = useMemo(() => new THREE.Line(stripGeometry), [stripGeometry])
  const stripMatRef = useRef<THREE.LineBasicMaterial>(null)

  useEffect(() => () => stripGeometry.dispose(), [stripGeometry])

  useFrame((_, frameDelta) => {
    const group = groupRef.current
    const peaks = peaksRef.current
    if (!group || !peaks) return
    clockRef.current += Math.min(frameDelta, MAX_DELTA)
    const time = clockRef.current
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const b = beats(p)

    group.visible = b.strip > 0.02
    if (!group.visible) return

    const positions = stripGeometry.getAttribute('position') as THREE.BufferAttribute
    const colors = stripGeometry.getAttribute('color') as THREE.BufferAttribute
    const travel = time * 0.9

    for (let i = 0; i < STRIP_POINTS; i++) {
      const u = i / (STRIP_POINTS - 1)
      // Sharp front at phase 0, slow decaying refill behind it.
      const phase = ((u * STRIP_WAVES - travel) % 1 + 1) % 1
      const height = 0.42 * Math.pow(Math.max(0, 1 - phase * 1.12), 2.6)
      positions.setXYZ(i, -1.5 + u * 3, -0.12 + height, 0)

      const brightness = Math.pow(1 - phase, 5)
      scratch.copy(refill).lerp(front, 0.25 + 0.75 * brightness)
      if (brightness > 0.8) scratch.lerp(core, (brightness - 0.8) * 3)
      colors.setXYZ(i, scratch.r, scratch.g, scratch.b)
    }
    positions.needsUpdate = true
    colors.needsUpdate = true
    if (stripMatRef.current) stripMatRef.current.opacity = b.strip

    // Glowing cores riding each front.
    for (let k = 0; k < STRIP_WAVES; k++) {
      const u = (((k + travel) / STRIP_WAVES) % 1 + 1) % 1
      const pulse = 0.8 + Math.sin(time * 10 + k * 2.1) * 0.2
      dummy.position.set(-1.5 + u * 3, -0.12 + 0.42, 0)
      dummy.scale.setScalar(0.045 * pulse * b.strip)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      peaks.setMatrixAt(k, dummy.matrix)
    }
    peaks.instanceMatrix.needsUpdate = true
    ;(peaks.material as THREE.MeshBasicMaterial).opacity = b.strip
  })

  return (
    <group ref={groupRef} visible={false}>
      <primitive object={stripLine}>
        <lineBasicMaterial
          ref={stripMatRef}
          attach="material"
          vertexColors
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </primitive>
      <instancedMesh ref={peaksRef} args={[undefined, undefined, STRIP_WAVES]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial
          color={CORE_COLOR}
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </group>
  )
}

interface CellSpec {
  x: number
  y: number
  color: THREE.Color
  /** 0 = locked band, 1 = galloping window, 2 = chaotic patch. */
  kind: number
  stagger: number
}

/** The actual result: diagonal N = 1-4 bands with galloping seams. */
function buildAtlasCells(): CellSpec[] {
  const bandColors = ['#57200e', '#8f3413', '#c9531c', '#ff7a29'].map(
    (c) => new THREE.Color(c),
  )
  const uniform = new THREE.Color('#4a453d')
  const gallop = new THREE.Color(GALLOP_COLOR)
  const cells: CellSpec[] = []
  for (let row = 0; row < ATLAS_ROWS; row++) {
    for (let col = 0; col < ATLAS_COLS; col++) {
      const i = row * ATLAS_COLS + col
      const fx = col / (ATLAS_COLS - 1)
      const fy = row / (ATLAS_ROWS - 1)
      // Diagonal staircase: plenum pressure pushes the count up, injector
      // stiffness pushes back. Normalized band coordinate in 0..1.
      const v = THREE.MathUtils.clamp(
        (fx * 1.15 - fy * 0.55 + 0.55) / 1.7 + (hash01(i * 17 + 5) - 0.5) * 0.02,
        0,
        1,
      )
      let color: THREE.Color
      let kind = 0
      if (fx > 0.86 && fy < 0.35) {
        // High plenum pressure, weak stiffness: uniform combustion, no waves.
        color = uniform
      } else {
        const boundaries = [0.28, 0.5, 0.72]
        const band = boundaries.filter((bnd) => v >= bnd).length
        color = bandColors[band]
        const nearest = Math.min(...boundaries.map((bnd) => Math.abs(v - bnd)))
        if (nearest < 0.018) {
          color = gallop
          kind = 1
        } else if (nearest < 0.05 && hash01(i * 23 + 11) < 0.3) {
          kind = 2
        }
      }
      cells.push({
        x: -1.45 + fx * 2.9,
        y: -0.82 + fy * 1.64,
        color,
        kind,
        stagger: hash01(i * 29 + 3),
      })
    }
  }
  return cells
}

function AtlasGrid({ progressRef }: { progressRef: ProgressRef }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const scratch = useMemo(() => new THREE.Color(), [])
  const clockRef = useRef(0)
  const cells = useMemo(() => buildAtlasCells(), [])

  useFrame((_, frameDelta) => {
    const mesh = meshRef.current
    const group = groupRef.current
    if (!mesh || !group) return
    clockRef.current += Math.min(frameDelta, MAX_DELTA)
    const time = clockRef.current
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const b = beats(p)

    group.visible = b.atlas > 0.02
    if (!group.visible) return
    // The finale pulls the whole atlas back and dims it under the counters.
    group.position.z = -b.finale * 0.8
    group.scale.setScalar(1 - b.finale * 0.12)
    const dim = 1 - 0.55 * b.finale

    for (let i = 0; i < ATLAS_COUNT; i++) {
      const cell = cells[i]
      if (!cell) continue
      // Cells resolve in a diagonal sweep with per-cell stagger, like the
      // parameter sweep completing.
      const sweep = range01(
        b.atlas * 1.5,
        ((cell.x + 1.45) / 2.9 + (cell.y + 0.82) / 1.64) * 0.45 + cell.stagger * 0.18,
        ((cell.x + 1.45) / 2.9 + (cell.y + 0.82) / 1.64) * 0.45 + cell.stagger * 0.18 + 0.3,
      )
      const pop = smoothstep(sweep)
      dummy.position.set(cell.x, cell.y, 0)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(Math.max(pop, 0.001))
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      scratch.copy(cell.color)
      if (cell.kind === 2) {
        // Chaotic patches flicker faintly - modulated, never locked.
        scratch.multiplyScalar(0.75 + 0.25 * Math.sin(time * 6 + cell.stagger * 40))
      }
      scratch.multiplyScalar(dim * (0.35 + 0.65 * pop))
      mesh.setColorAt(i, scratch)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    ;(mesh.material as THREE.MeshBasicMaterial).opacity = 0.95 * Math.min(b.atlas * 1.4, 1)
  })

  return (
    <group ref={groupRef} visible={false}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, ATLAS_COUNT]}>
        <boxGeometry args={[0.098, 0.088, 0.02]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  )
}

const RdeScene = memo(function RdeScene({
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
      <color attach="background" args={['#050507']} />
      <fog attach="fog" args={['#050507', 7, 13]} />
      <ambientLight intensity={0.32} />
      <directionalLight position={[3, 4, 5]} intensity={1.1} color="#f2ede6" />
      <pointLight position={[0, 0.6, 2.4]} intensity={1.1} color={FRONT_COLOR} distance={7} />
      <CameraRig progressRef={sceneProgressRef} reduced={reduced} />
      <DetonationRing progressRef={sceneProgressRef} />
      <UnrolledStrip progressRef={sceneProgressRef} />
      <AtlasGrid progressRef={sceneProgressRef} />
    </>
  )
})

function getTelemetry(progress: number) {
  const p = THREE.MathUtils.clamp(progress, 0, 1)
  let phase = 'The ring'
  let phaseDetail = 'One engine. One, two, three, four waves'
  let index = 1
  if (p >= 0.85) {
    phase = 'An open atlas'
    phaseDetail = '5,856 sims · six laboratories'
    index = 4
  } else if (p >= 0.56) {
    phase = 'The staircase'
    phaseDetail = 'Locked bands, galloping windows'
    index = 3
  } else if (p >= 0.32) {
    phase = 'The unroll'
    phaseDetail = 'A minimal model captures it'
    index = 2
  }

  const simsT = smoothstep(range01(p, 0.56, 0.82))
  const agreeT = smoothstep(range01(p, 0.85, 0.96))
  return {
    phase,
    phaseDetail,
    index,
    waves: String(Math.round(waveCount(p))),
    sims: simsT > 0 ? Math.round(5856 * simsT).toLocaleString('en-US') : '—',
    agree: agreeT > 0 ? `${Math.round(19 * agreeT)} / 24` : '—',
    cj: p >= 0.88 ? '−8–10%' : '—',
  }
}

export interface RdeAtlasProps {
  scrollProgress?: number
  progress?: MotionValue<number>
  active?: boolean
  className?: string
}

export function RdeAtlas({
  scrollProgress = 0,
  progress,
  active = true,
  className = '',
}: RdeAtlasProps) {
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
        className={`${className} research-viewer--rde`}
        progressPercent={Math.round(shownProgress * 100)}
        telemetry={
          <ViewerTelemetry
            label="Wave-count atlas"
            rows={[
              { key: 'Phase', value: telemetry.phase },
              { key: 'Waves', value: telemetry.waves },
              { key: 'Sims', value: telemetry.sims },
              { key: 'Agree', value: telemetry.agree },
              { key: 'vs CJ', value: telemetry.cj },
            ]}
          />
        }
        legend={
          <div className="research-viewer__legend">
            <span className="research-viewer__legend-item research-viewer__legend-item--rde-front">
              Detonation front
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--rde-core">
              Hot core
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--rde-refill">
              Refill region
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--rde-gallop">
              Galloping window
            </span>
          </div>
        }
      >
        <Canvas
          camera={{ position: [0, 1.7, 4.4], fov: 38, near: 0.1, far: 40 }}
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
            <RdeScene
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
