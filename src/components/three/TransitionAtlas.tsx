import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, Line } from '@react-three/drei'
import { useMotionValue, useMotionValueEvent, type MotionValue } from 'motion/react'
import * as THREE from 'three'
import { useIntersectionPause } from '../../hooks/useIntersectionPause'
import { useMotionProgressRef } from '../../hooks/useMotionProgressRef'
import { useThrottledMotionValue } from '../../hooks/useThrottledMotionValue'
import { smoothstep } from '../../lib/airfoilGeometry'
import {
  NLF_CHORD,
  buildNlfWingGeometry,
  dragCounts,
  envelopeBias,
  nlfLowerY,
  nlfProfileWorld,
  nlfUpperY,
  xcToWorld,
  xtrLower,
  xtrUpper,
  ycToWorld,
} from '../../lib/nlfGeometry'
import { ResearchViewerFrame, ViewerTelemetry } from '../research/ResearchViewerFrame'

const UPPER_COUNT = 200
const LOWER_COUNT = 100
const FREESTREAM_COUNT = 56
const SPAN = 0.9
/** Wing pitched to the cross-check condition: Re = 4×10⁶, α = 4°. */
const AOA_RAD = THREE.MathUtils.degToRad(-4)

const LAMINAR_COLOR = new THREE.Color('#22d3ee')
const TURBULENT_COLOR = new THREE.Color('#fb7185')
const FRONT_COLOR = '#818cf8'
const BRACKET_COLOR = '#86efac'
const OS_COLOR = '#22d3ee'
const ENVELOPE_MARK_COLOR = '#fb7185'

type ProgressRef = React.RefObject<number | null>

function range01(value: number, start: number, end: number): number {
  if (end <= start) return value >= end ? 1 : 0
  return THREE.MathUtils.clamp((value - start) / (end - start), 0, 1)
}

function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** The amplification-threshold dial: quiet air (13) → sweep to 5 → settle 5.5. */
function ncritAt(p: number): number {
  if (p < 0.45) return 13
  if (p < 0.68) return THREE.MathUtils.lerp(13, 5, smoothstep(range01(p, 0.45, 0.68)))
  return THREE.MathUtils.lerp(5, 5.5, smoothstep(range01(p, 0.74, 0.88)))
}

/** Boundary-layer thickness in unit-chord space; grows sharply past x_tr. */
function blThickness(xc: number, xtr: number): number {
  const x = Math.max(xc, 0.005)
  const laminar = 0.006 + 0.016 * Math.sqrt(x)
  if (xc <= xtr) return laminar
  const atTransition = 0.006 + 0.016 * Math.sqrt(Math.max(xtr, 0.005))
  return atTransition + 0.042 * Math.pow(xc - xtr, 0.85)
}

function CameraRig({ progressRef }: { progressRef: ProgressRef }) {
  const { camera } = useThree()
  const positionRef = useRef(new THREE.Vector3())
  const targetRef = useRef(new THREE.Vector3())

  useFrame(() => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const approach = smoothstep(range01(p, 0.24, 0.42))
    const validate = smoothstep(range01(p, 0.72, 0.9))
    const position = positionRef.current
    const target = targetRef.current

    position.set(
      THREE.MathUtils.lerp(-0.45, 0.55, approach) + validate * 1.15,
      THREE.MathUtils.lerp(0.24, 0.62, approach) + validate * 0.28,
      THREE.MathUtils.lerp(4.9, 3.7, approach) + validate * 0.65,
    )
    target.set(
      THREE.MathUtils.lerp(0, 0.38, approach) - validate * 0.22,
      THREE.MathUtils.lerp(0, 0.1, approach) - validate * 0.08,
      0,
    )

    camera.position.lerp(position, 0.1)
    camera.lookAt(target)
  })

  return null
}

function TunnelStage() {
  return (
    <group>
      <Grid
        args={[9, 5]}
        position={[0.2, -1.18, 0]}
        cellSize={0.3}
        cellThickness={0.25}
        sectionSize={1.2}
        sectionThickness={0.5}
        cellColor="#1e293b"
        sectionColor="#334155"
        fadeDistance={8}
        fadeStrength={1.6}
      />
      <mesh position={[0.2, -1.14, 0]}>
        <boxGeometry args={[5.6, 0.06, 2.2]} />
        <meshStandardMaterial color="#080d18" metalness={0.6} roughness={0.42} />
      </mesh>
    </group>
  )
}

function WingSection() {
  const geometry = useMemo(() => buildNlfWingGeometry(SPAN), [])
  const edgePoints = useMemo(() => {
    const profile = nlfProfileWorld()
    const points: [number, number, number][] = []
    for (let i = 0; i < profile.length / 2; i++) {
      points.push([profile[i * 2], profile[i * 2 + 1], SPAN / 2 + 0.002])
    }
    points.push(points[0])
    return points
  }, [])

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#3e5174"
          metalness={0.22}
          roughness={0.42}
          clearcoat={0.35}
        />
      </mesh>
      <Line points={edgePoints} color={FRONT_COLOR} transparent opacity={0.45} lineWidth={1.2} />
    </group>
  )
}

interface StreamSeed {
  lane: number
  zLane: number
  phase: number
  speed: number
  size: number
}

function makeSeeds(count: number, salt: number): StreamSeed[] {
  return Array.from({ length: count }, (_, index) => {
    const zRow = index % 3
    return {
      lane: 0.15 + hash01(index * 5 + salt) * 0.8,
      zLane: (zRow - 1) * 0.28 + (hash01(index * 5 + salt + 1) - 0.5) * 0.16,
      phase: hash01(index * 5 + salt + 2),
      speed: 0.085 + hash01(index * 5 + salt + 3) * 0.03,
      size: 0.75 + hash01(index * 5 + salt + 4) * 0.5,
    }
  })
}

function BoundaryLayerStream({
  surface,
  progressRef,
}: {
  surface: 'upper' | 'lower'
  progressRef: ProgressRef
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const count = surface === 'upper' ? UPPER_COUNT : LOWER_COUNT
  const seeds = useMemo(() => makeSeeds(count, surface === 'upper' ? 0 : 900), [count, surface])
  const sign = surface === 'upper' ? 1 : -1
  const surfaceY = surface === 'upper' ? nlfUpperY : nlfLowerY
  const xtrOf = surface === 'upper' ? xtrUpper : xtrLower

  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return

    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const time = state.clock.elapsedTime
    const flowReveal = smoothstep(range01(p, 0.08, 0.2))
    const tsFactor = smoothstep(range01(p, 0.26, 0.42))
    const ncrit = ncritAt(p)
    const xtr = xtrOf(ncrit)
    const tsOnset = Math.max(xtr - 0.18, 0.05)

    for (let i = 0; i < count; i++) {
      const seed = seeds[i]
      const s = (time * seed.speed + seed.phase) % 1
      const xc = THREE.MathUtils.lerp(-0.35, 1.9, s)
      const onBody = xc >= 0 && xc <= 1
      const turbulent = xc > xtr

      const delta = blThickness(Math.min(xc, 1.9), xtr)
      let yc: number
      if (xc < 0) {
        yc = sign * (0.01 + seed.lane * 0.012) + 0.05 * -xc * sign * 0.2
      } else if (onBody) {
        yc = surfaceY(xc) + sign * seed.lane * delta
      } else {
        yc = sign * seed.lane * delta - 0.012 * (xc - 1)
      }

      // Tollmien–Schlichting waves: grow toward the front, then break down.
      if (onBody && xc > tsOnset && xc <= xtr) {
        const growth = (xc - tsOnset) / Math.max(xtr - tsOnset, 0.01)
        yc +=
          sign *
          Math.sin(xc * 72 - time * 7 + seed.phase * 12) *
          0.0075 *
          growth *
          growth *
          tsFactor
      }

      let zJitter = 0
      if (turbulent && xc > 0) {
        const churn = Math.min((xc - xtr) * 3.2, 1)
        yc +=
          Math.sin(i * 12.9 + time * 9.5) *
          Math.sin(i * 7.7 + time * 6.1) *
          delta *
          0.4 *
          churn
        zJitter = Math.sin(i * 5.3 + time * 7.3) * 0.038 * churn
      }

      const xw = xcToWorld(xc)
      const yw = ycToWorld(yc)
      dummy.position.set(xw, yw, seed.zLane + zJitter)

      // Align streaks with the local surface slope while on-body.
      if (onBody) {
        const ahead = surfaceY(Math.min(xc + 0.03, 1))
        dummy.rotation.set(
          0,
          0,
          Math.atan2((ahead - surfaceY(xc)) * NLF_CHORD, 0.03 * NLF_CHORD),
        )
      } else {
        dummy.rotation.set(0, 0, 0)
      }

      const stretch = turbulent ? 1.1 : 1.9
      dummy.scale.set(
        0.032 * seed.size * stretch,
        0.0075 * seed.size * (turbulent ? 1.4 : 1),
        0.0075 * seed.size * (turbulent ? 1.4 : 1),
      )
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      const mix = turbulent ? Math.min((xc - xtr) * 6, 1) : 0
      color.copy(LAMINAR_COLOR).lerp(TURBULENT_COLOR, mix)
      mesh.setColorAt(i, color)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    ;(mesh.material as THREE.MeshBasicMaterial).opacity = flowReveal * 0.85
    mesh.visible = flowReveal > 0.02
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} visible={false}>
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

/** Distant freestream streaks — context for flow direction and speed. */
function FreestreamFlow({ progressRef }: { progressRef: ProgressRef }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const seeds = useMemo(() => makeSeeds(FREESTREAM_COUNT, 1800), [])

  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const reveal = smoothstep(range01(p, 0.06, 0.16))
    const time = state.clock.elapsedTime

    for (let i = 0; i < FREESTREAM_COUNT; i++) {
      const seed = seeds[i]
      const s = (time * seed.speed * 1.5 + seed.phase) % 1
      const xc = THREE.MathUtils.lerp(-0.45, 2.0, s)
      const side = i % 2 === 0 ? 1 : -1
      const yc = side * (0.22 + seed.lane * 0.18)
      dummy.position.set(xcToWorld(xc), ycToWorld(yc), seed.zLane * 1.4)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(0.055 * seed.size, 0.005, 0.005)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    ;(mesh.material as THREE.MeshBasicMaterial).opacity = reveal * 0.3
    mesh.visible = reveal > 0.02
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, FREESTREAM_COUNT]} visible={false}>
      <sphereGeometry args={[1, 5, 5]} />
      <meshBasicMaterial
        color="#94a3b8"
        transparent
        opacity={0}
        toneMapped={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  )
}

/** Glowing spanwise band at x_tr — the front the whole paper is about. */
function TransitionFront({
  surface,
  progressRef,
}: {
  surface: 'upper' | 'lower'
  progressRef: ProgressRef
}) {
  const groupRef = useRef<THREE.Group>(null)
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)
  const surfaceY = surface === 'upper' ? nlfUpperY : nlfLowerY
  const xtrOf = surface === 'upper' ? xtrUpper : xtrLower
  const lockColor = useMemo(() => new THREE.Color(BRACKET_COLOR), [])
  const baseColor = useMemo(() => new THREE.Color(FRONT_COLOR), [])
  const currentColor = useMemo(() => new THREE.Color(FRONT_COLOR), [])

  useFrame((state) => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const reveal = smoothstep(range01(p, 0.3, 0.4))
    const lock = surface === 'upper' ? smoothstep(range01(p, 0.9, 0.98)) : 0
    const ncrit = ncritAt(p)
    const xtr = xtrOf(ncrit)

    if (groupRef.current) {
      groupRef.current.visible = reveal > 0.02
      groupRef.current.position.set(xcToWorld(xtr), ycToWorld(surfaceY(xtr)), 0)
    }
    if (materialRef.current) {
      const pulse = 0.75 + Math.sin(state.clock.elapsedTime * 5.2) * 0.25
      currentColor.copy(baseColor).lerp(lockColor, lock)
      materialRef.current.emissive.copy(currentColor)
      materialRef.current.color.copy(currentColor)
      materialRef.current.emissiveIntensity = (1.6 + pulse * 1.6) * (surface === 'upper' ? 1 : 0.55)
      materialRef.current.opacity = reveal * (surface === 'upper' ? 0.95 : 0.5)
    }
  })

  return (
    <group ref={groupRef} visible={false}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.013, 0.013, SPAN + 0.05, 10]} />
        <meshStandardMaterial
          ref={materialRef}
          color={FRONT_COLOR}
          emissive={FRONT_COLOR}
          emissiveIntensity={2}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

/** §3 cross-check: envelope front (rose) vs full Orr–Sommerfeld front (cyan). */
function BiasMarkers({ progressRef }: { progressRef: ProgressRef }) {
  const groupRef = useRef<THREE.Group>(null)
  const envGroup = useRef<THREE.Group>(null)
  const osGroup = useRef<THREE.Group>(null)
  const bandRef = useRef<THREE.Mesh>(null)
  const envMaterial = useRef<THREE.LineBasicMaterial | null>(null)
  const osMaterial = useRef<THREE.LineBasicMaterial | null>(null)

  useFrame(() => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const reveal =
      smoothstep(range01(p, 0.64, 0.72)) * (1 - 0.55 * smoothstep(range01(p, 0.88, 0.96)))
    const ncrit = ncritAt(p)
    const xEnv = xtrUpper(ncrit)
    const xOs = xEnv - envelopeBias(ncrit)

    if (groupRef.current) groupRef.current.visible = reveal > 0.02
    if (envGroup.current) {
      envGroup.current.position.set(xcToWorld(xEnv), ycToWorld(nlfUpperY(xEnv)) + 0.015, 0)
    }
    if (osGroup.current) {
      osGroup.current.position.set(xcToWorld(xOs), ycToWorld(nlfUpperY(xOs)) + 0.015, 0)
    }
    if (envMaterial.current) envMaterial.current.opacity = reveal * 0.95
    if (osMaterial.current) osMaterial.current.opacity = reveal * 0.95
    if (bandRef.current) {
      const xMid = (xEnv + xOs) / 2
      const width = Math.max((xEnv - xOs) * NLF_CHORD, 0.001)
      bandRef.current.position.set(xcToWorld(xMid), ycToWorld(nlfUpperY(xMid)) + 0.05, 0)
      bandRef.current.scale.x = width
      ;(bandRef.current.material as THREE.MeshBasicMaterial).opacity = reveal * 0.3
    }
  })

  return (
    <group ref={groupRef} visible={false}>
      <group ref={envGroup}>
        <Line
          points={[
            [0, 0, 0],
            [0, 0.16, 0],
          ]}
          color={ENVELOPE_MARK_COLOR}
          transparent
          opacity={0}
          lineWidth={2.2}
          onUpdate={(line: THREE.Line) => {
            envMaterial.current = line.material as THREE.LineBasicMaterial
          }}
        />
      </group>
      <group ref={osGroup}>
        <Line
          points={[
            [0, 0, 0],
            [0, 0.16, 0],
          ]}
          color={OS_COLOR}
          transparent
          opacity={0}
          lineWidth={2.2}
          onUpdate={(line: THREE.Line) => {
            osMaterial.current = line.material as THREE.LineBasicMaterial
          }}
        />
      </group>
      <mesh ref={bandRef}>
        <boxGeometry args={[1, 0.09, SPAN + 0.04]} />
        <meshBasicMaterial
          color="#fbbf24"
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

const ORIFICE_XC = [0.03, 0.08, 0.13, 0.18, 0.23, 0.275, 0.31, 0.34, 0.38, 0.44, 0.5, 0.57]
const BRACKET_START = 5
const BRACKET_END = 7

/** §4 ground truth: the 1981 microphone-orifice row and its bracket. */
function OrificeRow({ progressRef }: { progressRef: ProgressRef }) {
  const dotRefs = useRef<THREE.Mesh[]>([])
  const barRef = useRef<THREE.Mesh>(null)

  const positions = useMemo(
    () =>
      ORIFICE_XC.map((xc) => [xcToWorld(xc), ycToWorld(nlfUpperY(xc)) + 0.012, 0] as const),
    [],
  )
  const barSpec = useMemo(() => {
    const x0 = xcToWorld(ORIFICE_XC[BRACKET_START])
    const x1 = xcToWorld(ORIFICE_XC[BRACKET_END])
    const y =
      (ycToWorld(nlfUpperY(ORIFICE_XC[BRACKET_START])) +
        ycToWorld(nlfUpperY(ORIFICE_XC[BRACKET_END]))) /
        2 +
      0.05
    return { x: (x0 + x1) / 2, y, width: x1 - x0 }
  }, [])

  useFrame((state) => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const time = state.clock.elapsedTime
    dotRefs.current.forEach((dot, index) => {
      if (!dot) return
      const reveal = smoothstep(range01(p, 0.82 + index * 0.008, 0.88 + index * 0.008))
      const bracket = index >= BRACKET_START && index <= BRACKET_END
      dot.visible = reveal > 0.02
      dot.scale.setScalar(Math.max(reveal, 0.001) * (bracket ? 1.25 : 1))
      const material = dot.material as THREE.MeshStandardMaterial
      material.opacity = reveal
      if (bracket) {
        material.emissiveIntensity = 1.4 + Math.sin(time * 4.5) * 0.7
      }
    })
    if (barRef.current) {
      const reveal = smoothstep(range01(p, 0.88, 0.96))
      barRef.current.visible = reveal > 0.02
      ;(barRef.current.material as THREE.MeshBasicMaterial).opacity = reveal * 0.4
    }
  })

  return (
    <group>
      {positions.map(([x, y, z], index) => {
        const bracket = index >= BRACKET_START && index <= BRACKET_END
        return (
          <mesh
            key={index}
            position={[x, y, z]}
            visible={false}
            ref={(mesh) => {
              if (mesh) dotRefs.current[index] = mesh
            }}
          >
            <sphereGeometry args={[0.016, 10, 10]} />
            <meshStandardMaterial
              color={bracket ? BRACKET_COLOR : '#94a3b8'}
              emissive={bracket ? BRACKET_COLOR : '#334155'}
              emissiveIntensity={bracket ? 1.4 : 0.4}
              transparent
              opacity={0}
              toneMapped={false}
            />
          </mesh>
        )
      })}
      <mesh ref={barRef} position={[barSpec.x, barSpec.y, 0]} visible={false}>
        <boxGeometry args={[barSpec.width, 0.012, 0.02]} />
        <meshBasicMaterial
          color={BRACKET_COLOR}
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

function AtlasScene({ progressRef }: { progressRef: ProgressRef }) {
  return (
    <>
      <color attach="background" args={['#040711']} />
      <fog attach="fog" args={['#040711', 7, 11.5]} />
      <ambientLight intensity={0.42} />
      <directionalLight position={[4, 5, 5]} intensity={1.9} color="#f8fafc" castShadow />
      <directionalLight position={[-4, 2, 3]} intensity={0.7} color="#818cf8" />
      <pointLight position={[-1.8, 0.6, 1.6]} intensity={0.9} color="#22d3ee" distance={5} />
      <pointLight position={[0.6, 1.3, 2.1]} intensity={0.8} color="#e2e8f0" distance={6} />
      <CameraRig progressRef={progressRef} />
      <TunnelStage />
      <group rotation={[0, 0, AOA_RAD]}>
        <WingSection />
        <BoundaryLayerStream surface="upper" progressRef={progressRef} />
        <BoundaryLayerStream surface="lower" progressRef={progressRef} />
        <FreestreamFlow progressRef={progressRef} />
        <TransitionFront surface="upper" progressRef={progressRef} />
        <TransitionFront surface="lower" progressRef={progressRef} />
        <BiasMarkers progressRef={progressRef} />
        <OrificeRow progressRef={progressRef} />
      </group>
    </>
  )
}

function getTelemetry(progress: number) {
  const p = THREE.MathUtils.clamp(progress, 0, 1)
  let phase = 'NLF(1)-0416'
  let phaseDetail = 'Somers 1981 · NASA TP-1861'
  let index = 1
  if (p >= 0.84) {
    phase = '1981 validation'
    phaseDetail = 'Front lands in the orifice bracket'
    index = 6
  } else if (p >= 0.66) {
    phase = 'OS cross-check'
    phaseDetail = 'Envelope runs 0.010–0.035c aft'
    index = 5
  } else if (p >= 0.45) {
    phase = 'Ncrit sweep'
    phaseDetail = 'One dial moves the transition front'
    index = 4
  } else if (p >= 0.26) {
    phase = 'eᴺ amplification'
    phaseDetail = 'TS waves grow toward breakdown'
    index = 3
  } else if (p >= 0.1) {
    phase = 'Laminar run'
    phaseDetail = 'Ordered, low-friction boundary layer'
    index = 2
  }

  const ncrit = ncritAt(p)
  return {
    phase,
    phaseDetail,
    index,
    ncrit: ncrit.toFixed(1),
    xtr: `${xtrUpper(ncrit).toFixed(3)}c`,
    drag: `${dragCounts(ncrit).toFixed(1)} cts`,
    reynolds: '4.0×10⁶',
  }
}

export interface TransitionAtlasProps {
  scrollProgress?: number
  progress?: MotionValue<number>
  active?: boolean
  className?: string
}

export function TransitionAtlas({
  scrollProgress = 0,
  progress,
  active = true,
  className = '',
}: TransitionAtlasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isVisible = useIntersectionPause(containerRef)
  const progressRef = useMotionProgressRef(progress, scrollProgress)
  const fallbackProgress = useMotionValue(scrollProgress)
  const source = progress ?? fallbackProgress
  const liveProgress = useThrottledMotionValue(source, 100)

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
        className={`${className} research-viewer--transition`}
        progressPercent={Math.round(liveProgress * 100)}
        telemetry={
          <ViewerTelemetry
            label="Transition atlas"
            rows={[
              { key: 'Phase', value: telemetry.phase },
              { key: 'Ncrit', value: telemetry.ncrit },
              { key: 'xtr / c', value: telemetry.xtr },
              { key: 'Drag', value: telemetry.drag },
              { key: 'Re · α', value: `${telemetry.reynolds} · 4°` },
            ]}
          />
        }
        legend={
          <div className="research-viewer__legend">
            <span className="research-viewer__legend-item research-viewer__legend-item--tr-laminar">
              Laminar
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--tr-turbulent">
              Turbulent
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--tr-front">
              Transition front
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--tr-bracket">
              1981 orifice bracket
            </span>
          </div>
        }
      >
        <Canvas
          camera={{ position: [-0.45, 0.24, 4.9], fov: 38, near: 0.1, far: 40 }}
          dpr={[1, 1.5]}
          shadows
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
          }}
          frameloop={isVisible && active ? 'always' : 'demand'}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <AtlasScene progressRef={progressRef} />
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
