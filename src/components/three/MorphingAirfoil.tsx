import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { useMotionValue, useMotionValueEvent, type MotionValue } from 'motion/react'
import * as THREE from 'three'
import { useIntersectionPause } from '../../hooks/useIntersectionPause'
import { useMotionProgressRef } from '../../hooks/useMotionProgressRef'
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

type ProgressRef = React.RefObject<number | null>

function range01(value: number, start: number, end: number) {
  return THREE.MathUtils.clamp((value - start) / (end - start), 0, 1)
}

function CameraRig({ progressRef }: { progressRef: ProgressRef }) {
  const { camera } = useThree()
  const positionRef = useRef(new THREE.Vector3())
  const targetRef = useRef(new THREE.Vector3())

  useFrame(() => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const flow = smoothstep(range01(p, 0.08, 0.32))
    const section = smoothstep(range01(p, 0.32, 0.58))
    const settle = smoothstep(range01(p, 0.8, 1))
    const position = positionRef.current
    const target = targetRef.current
    position.set(
      THREE.MathUtils.lerp(2.7, 0.2, section) + settle * 0.16,
      THREE.MathUtils.lerp(1.25, 0.3, flow) + settle * 0.1,
      THREE.MathUtils.lerp(4.75, 4.2, section) - settle * 0.18,
    )
    target.set(THREE.MathUtils.lerp(-0.18, 0.08, section), 0.02, 0)
    camera.position.lerp(position, 0.1)
    camera.lookAt(target)
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
  const lineGroups = useRef<THREE.Group[]>([])
  const materialRefs = useRef<THREE.LineBasicMaterial[]>([])
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
      return { points, baseY }
    })
  }, [])

  useFrame((state) => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const reveal = smoothstep(range01(p, 0.1, 0.3))
    const optimized = smoothstep(range01(p, 0.62, 0.9))
    const cl = morphRef.current?.cl ?? 0.82
    lineGroups.current.forEach((group, index) => {
      if (!group) return
      group.visible = reveal > 0.02
      group.position.x = ((state.clock.elapsedTime * (0.08 + optimized * 0.08) + index * 0.07) % 0.14) - 0.07
      group.scale.y = 1 + (cl - 0.8) * 0.16
    })
    materialRefs.current.forEach((material, index) => {
      material.opacity = reveal * (0.12 + optimized * 0.08 + (index % 3) * 0.025)
      material.color.set(index > 5 ? SUCTION_COLOR : FLOW_COLOR)
    })
  })

  return (
    <>
      {lines.map((line, index) => (
        <group
          key={index}
          ref={(group) => {
            if (group) lineGroups.current[index] = group
          }}
          visible={false}
        >
          <Line
            points={line.points}
            color={FLOW_COLOR}
            transparent
            opacity={0}
            lineWidth={index === 5 || index === 6 ? 1.5 : 1}
            dashed
            dashSize={0.09}
            gapSize={0.055}
            onUpdate={(lineObject: THREE.Line) => {
              materialRefs.current[index] = lineObject.material as THREE.LineBasicMaterial
            }}
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
    const pulse = Math.sin(range01(p, 0.36, 0.64) * Math.PI)
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
}: {
  progressRef: ProgressRef
  active: boolean
  profiles: AirfoilProfile[]
  morphRef: React.RefObject<MorphState | null>
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

  useFrame(() => {
    if (!active) return
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
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
    if (groupRef.current) {
      groupRef.current.rotation.z = THREE.MathUtils.lerp(
        THREE.MathUtils.degToRad(2),
        THREE.MathUtils.degToRad(morph.aoa),
        smoothstep(range01(p, 0.18, 0.48)),
      )
      groupRef.current.rotation.y = THREE.MathUtils.lerp(0.05, -0.08, range01(p, 0.75, 1))
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
    const reveal = smoothstep(range01(p, 0.18, 0.4))
    const morph = morphRef.current
    if (!morph || !liftRef.current || !dragRef.current) return
    liftRef.current.scale.y = reveal * (0.28 + morph.cl * 0.3)
    dragRef.current.scale.x = reveal * (0.2 + morph.cd * 5.5)
    ;(liftRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + reveal * 1.6
    ;(dragRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + reveal * 1.2
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

function TunnelScene({
  progressRef,
  active,
  profiles,
}: {
  progressRef: ProgressRef
  active: boolean
  profiles: AirfoilProfile[]
}) {
  const morphRef = useRef<MorphState | null>(null)
  return (
    <>
      <color attach="background" args={['#040711']} />
      <fog attach="fog" args={['#040711', 6.5, 10]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[4, 5, 5]} intensity={1.7} color="#f8fafc" castShadow />
      <directionalLight position={[-4, 2, 3]} intensity={0.72} color={SUCTION_COLOR} />
      <pointLight position={[-2.2, 0, 1.4]} intensity={0.8} color={FLOW_COLOR} distance={4} />
      <pointLight position={[2.2, 0, 1.2]} intensity={0.45} color={LIFT_COLOR} distance={3} />
      <CameraRig progressRef={progressRef} />
      <WindTunnel />
      <StingMount />
      <FlowRibbons progressRef={progressRef} morphRef={morphRef} />
      <AirfoilModel progressRef={progressRef} active={active} profiles={profiles} morphRef={morphRef} />
      <ForceBalance progressRef={progressRef} morphRef={morphRef} />
    </>
  )
}

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
  const progressRef = useMotionProgressRef(progress, scrollProgress)
  const fallbackProgress = useMotionValue(scrollProgress)
  const source = progress ?? fallbackProgress
  const profiles = variant === 'featured' ? FEATURED_AIRFOIL_PROFILES : RESEARCH_AIRFOIL_PROFILES
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

  const telemetry = getTelemetry(liveProgress, profiles)

  return (
    <div ref={containerRef}>
      <ResearchViewerFrame
        className={`${className} research-viewer--airfoil`}
        progressPercent={Math.round(liveProgress * 100)}
        telemetry={
          <ViewerTelemetry
            label="Wind tunnel"
            rows={[
              { key: 'Phase', value: telemetry.phase },
              { key: 'Profile', value: telemetry.morph.profile.label },
              { key: 'Cₗ', value: telemetry.morph.cl.toFixed(2) },
              { key: 'Cᴅ', value: telemetry.morph.cd.toFixed(3) },
              { key: 'Mode', value: telemetry.mode },
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
          shadows
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
          frameloop={isVisible && active ? 'always' : 'demand'}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <TunnelScene progressRef={progressRef} active={isVisible && active} profiles={profiles} />
          </Suspense>
        </Canvas>
        <div className="viewer-phase" aria-hidden="true">
          <span className="viewer-phase__index">{String(Math.min(4, Math.floor(liveProgress * 5)) + 1).padStart(2, '0')}</span>
          <span className="viewer-phase__copy"><strong>{telemetry.phase}</strong><small>{telemetry.detail}</small></span>
        </div>
      </ResearchViewerFrame>
    </div>
  )
}
