import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { useMotionValueEvent, useMotionValue, type MotionValue } from 'motion/react'
import * as THREE from 'three'
import { useIntersectionPause } from '../../hooks/useIntersectionPause'
import { smoothstep } from '../../lib/airfoilGeometry'
import {
  ConferenceBadgeOverlay,
  ResearchViewerFrame,
  ViewerTelemetry,
} from '../research/ResearchViewerFrame'

const EARTH_RADIUS = 1.15
const ORBIT_RADIUS = 2.35
const DEBRIS_COUNT = 260

interface DebrisState {
  angle: number
  incline: number
  radius: number
  scale: number
  spin: number
}

function CameraRig({ progressRef }: { progressRef: React.RefObject<number | null> }) {
  const { camera } = useThree()
  const lookAt = useMemo(() => new THREE.Vector3(0, 0, 0), [])

  useFrame(() => {
    const p = smoothstep(progressRef.current ?? 0)
    const angle = THREE.MathUtils.lerp(0.5, 1.15, p)
    const radius = THREE.MathUtils.lerp(5.8, 4.9, p)
    const elevation = THREE.MathUtils.lerp(0.85, 1.35, p)
    camera.position.set(
      Math.sin(angle) * radius,
      elevation,
      Math.cos(angle) * radius,
    )
    camera.lookAt(lookAt)
  })

  return null
}

function Earth() {
  const earthRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (earthRef.current) earthRef.current.rotation.y = state.clock.elapsedTime * 0.04
  })

  return (
    <group>
      <mesh ref={earthRef}>
        <icosahedronGeometry args={[EARTH_RADIUS, 3]} />
        <meshPhysicalMaterial
          color="#2a5fd4"
          emissive="#0a1840"
          emissiveIntensity={0.35}
          metalness={0.15}
          roughness={0.55}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[EARTH_RADIUS * 1.04, 2]} />
        <meshBasicMaterial color="#6eb5ff" wireframe transparent opacity={0.12} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[EARTH_RADIUS * 1.35, EARTH_RADIUS * 1.42, 64]} />
        <meshBasicMaterial color="#818cf8" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function OrbitTrack() {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a) * ORBIT_RADIUS, 0, Math.sin(a) * ORBIT_RADIUS))
    }
    return pts
  }, [])

  return (
    <Line points={points} color="#c9a962" transparent opacity={0.35} lineWidth={1} />
  )
}

function DebrisField({ progressRef }: { progressRef: React.RefObject<number | null> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const states = useMemo(() => {
    const result: DebrisState[] = []
    for (let i = 0; i < DEBRIS_COUNT; i++) {
      result.push({
        angle: Math.random() * Math.PI * 2,
        incline: (Math.random() - 0.5) * 0.55,
        radius: ORBIT_RADIUS + (Math.random() - 0.5) * 0.45,
        scale: 0.025 + Math.random() * 0.04,
        spin: Math.random() * Math.PI,
      })
    }
    return result
  }, [])

  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return
    const p = smoothstep(progressRef.current ?? 0)
    const captured = Math.floor(p * DEBRIS_COUNT * 0.72)
    const t = state.clock.elapsedTime

    states.forEach((d, i) => {
      const isCaptured = i < captured
      const angle = d.angle + t * 0.08
      const x = Math.cos(angle) * d.radius
      const z = Math.sin(angle) * d.radius
      const y = d.incline + (isCaptured ? THREE.MathUtils.lerp(0, 0.35, p) : 0)

      dummy.position.set(x, y, z)
      dummy.rotation.set(d.spin + t * 0.5, d.spin * 0.7, t * 0.3)
      const scale = isCaptured ? d.scale * (1 - p * 0.85) : d.scale
      dummy.scale.setScalar(Math.max(0.001, scale))
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, DEBRIS_COUNT]}>
      <boxGeometry args={[1, 0.4, 0.6]} />
      <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.35} />
    </instancedMesh>
  )
}

function SweepSpacecraft({ progressRef }: { progressRef: React.RefObject<number | null> }) {
  const groupRef = useRef<THREE.Group>(null)
  const beamRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const p = smoothstep(progressRef.current ?? 0)
    const t = state.clock.elapsedTime
    if (groupRef.current) {
      const angle = t * 0.12 + p * 0.8
      groupRef.current.position.set(
        Math.cos(angle) * (ORBIT_RADIUS - 0.15),
        0.12 + Math.sin(t * 0.4) * 0.03,
        Math.sin(angle) * (ORBIT_RADIUS - 0.15),
      )
      groupRef.current.lookAt(0, 0, 0)
      groupRef.current.rotateY(Math.PI / 2)
    }
    if (beamRef.current) {
      const active = p > 0.15 && p < 0.92
      beamRef.current.visible = active
      beamRef.current.scale.set(1, 1, THREE.MathUtils.lerp(0.2, 1.4, (p - 0.15) / 0.77))
      ;(beamRef.current.material as THREE.MeshBasicMaterial).opacity = active
        ? 0.15 + Math.sin(t * 8) * 0.05
        : 0
    }
  })

  return (
    <group ref={groupRef}>
      <mesh>
        <boxGeometry args={[0.22, 0.14, 0.32]} />
        <meshPhysicalMaterial color="#e2e8f0" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[0.28, 0, 0]}>
        <boxGeometry args={[0.38, 0.02, 0.14]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[-0.28, 0, 0]}>
        <boxGeometry args={[0.38, 0.02, 0.14]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, -0.28]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.35, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh ref={beamRef} position={[0, 0, 0.55]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.12, 0.9, 16, 1, true]} />
        <meshBasicMaterial color="#86efac" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function EjectionTrail({ progressRef }: { progressRef: React.RefObject<number | null> }) {
  const matRef = useRef<THREE.LineBasicMaterial>(null)

  useFrame(() => {
    if (!matRef.current) return
    const p = smoothstep(progressRef.current ?? 0)
    matRef.current.opacity = p > 0.55 ? THREE.MathUtils.lerp(0, 0.65, (p - 0.55) / 0.45) : 0
  })

  const geom = useMemo(
    () =>
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.2, 0),
        new THREE.Vector3(2.8, 0.5, 1.2),
      ]),
    [],
  )

  const line = useMemo(
    () => new THREE.Line(geom, new THREE.LineBasicMaterial({ color: '#e8a317', transparent: true, opacity: 0 })),
    [geom],
  )

  useEffect(() => {
    matRef.current = line.material as THREE.LineBasicMaterial
    return () => {
      geom.dispose()
      line.material.dispose()
    }
  }, [line, geom])

  return <primitive object={line} />
}

function DebrisScene({
  progressRef,
  active,
}: {
  progressRef: React.RefObject<number | null>
  active: boolean
}) {
  if (!active) return null

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[6, 5, 4]} intensity={1.1} color="#f8fafc" />
      <directionalLight position={[-4, 2, -3]} intensity={0.25} color="#818cf8" />
      <pointLight position={[0, 2, 3]} intensity={0.2} color="#c9a962" />
      <CameraRig progressRef={progressRef} />
      <Earth />
      <OrbitTrack />
      <DebrisField progressRef={progressRef} />
      <SweepSpacecraft progressRef={progressRef} />
      <EjectionTrail progressRef={progressRef} />
    </>
  )
}

function getTelemetry(progress: number) {
  const p = smoothstep(progress)
  const phases = p < 0.33 ? 'Survey' : p < 0.66 ? 'Capture' : 'Eject'
  const tracked = Math.round(THREE.MathUtils.lerp(847, 214, p))
  return {
    phase: phases,
    tracked: String(tracked),
    altitude: '550 km',
    cleared: `${Math.round(p * 72)}%`,
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
  const progressRef = useRef(scrollProgress)
  const fallbackProgress = useMotionValue(scrollProgress)
  const source = progress ?? fallbackProgress
  const [liveProgress, setLiveProgress] = useState(scrollProgress)

  useEffect(() => {
    if (!progress) fallbackProgress.set(scrollProgress)
  }, [progress, scrollProgress, fallbackProgress])

  useMotionValueEvent(source, 'change', (v) => {
    progressRef.current = v
    setLiveProgress(v)
  })

  useEffect(() => {
    if (!progress) {
      progressRef.current = scrollProgress
      setLiveProgress(scrollProgress)
    }
  }, [progress, scrollProgress])

  const telemetry = getTelemetry(liveProgress)

  return (
    <div ref={containerRef}>
      <ResearchViewerFrame
        className={className}
        progressPercent={Math.round(liveProgress * 100)}
        badge={
          showConferenceBadge ? (
            <ConferenceBadgeOverlay
              conference="AAS"
              number="248"
              location="Pasadena, California"
            />
          ) : undefined
        }
        telemetry={
          <ViewerTelemetry
            label="Orbital telemetry"
            rows={[
              { key: 'Phase', value: telemetry.phase },
              { key: 'Tracked', value: telemetry.tracked },
              { key: 'Altitude', value: telemetry.altitude },
              { key: 'Cleared', value: telemetry.cleared },
            ]}
          />
        }
        legend={
          <div className="research-viewer__legend">
            <span className="research-viewer__legend-item research-viewer__legend-item--capture">
              SWEEP capture
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--debris">
              Debris field
            </span>
          </div>
        }
      >
        <Canvas
          camera={{ position: [0, 1.2, 5.5], fov: 42, near: 0.1, far: 80 }}
          dpr={[1, 1.5]}
          gl={{ alpha: true, antialias: true }}
          frameloop={isVisible && active ? 'always' : 'demand'}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <DebrisScene progressRef={progressRef} active={isVisible && active} />
          </Suspense>
        </Canvas>
      </ResearchViewerFrame>
    </div>
  )
}
