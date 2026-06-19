import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { useMotionValueEvent, useMotionValue, type MotionValue } from 'motion/react'
import * as THREE from 'three'
import { useIntersectionPause } from '../../hooks/useIntersectionPause'
import { smoothstep } from '../../lib/airfoilGeometry'
import { ResearchViewerFrame, ViewerTelemetry } from '../research/ResearchViewerFrame'

const ROAD_LENGTH = 14
const LANES = 3
const CARS_PER_LANE = 28
const TOTAL_CARS = LANES * CARS_PER_LANE

interface CarState {
  lane: number
  offset: number
  speedJitter: number
}

function CameraRig({ progressRef }: { progressRef: React.RefObject<number | null> }) {
  const { camera } = useThree()

  useFrame(() => {
    const p = smoothstep(progressRef.current ?? 0)
    camera.position.set(
      THREE.MathUtils.lerp(-2, 0.5, p),
      THREE.MathUtils.lerp(9.5, 7.8, p),
      THREE.MathUtils.lerp(0.5, 2.2, p),
    )
    camera.lookAt(THREE.MathUtils.lerp(-1, 1, p), 0, 0)
  })

  return null
}

function RoadSurface() {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <mesh>
        <planeGeometry args={[ROAD_LENGTH, 4.2]} />
        <meshStandardMaterial color="#1a2030" metalness={0.1} roughness={0.85} />
      </mesh>
      {[-1.4, 0, 1.4].map((y) => (
        <Line
          key={y}
          points={[
            [-ROAD_LENGTH / 2, y, 0.01],
            [ROAD_LENGTH / 2, y, 0.01],
          ]}
          color="#475569"
          lineWidth={1}
          transparent
          opacity={0.5}
        />
      ))}
      <Line
        points={[
          [-ROAD_LENGTH / 2, 0, 0.02],
          [ROAD_LENGTH / 2, 0, 0.02],
        ]}
        color="#fbbf24"
        lineWidth={2}
        transparent
        opacity={0.35}
        dashed
        dashSize={0.4}
        gapSize={0.35}
      />
    </group>
  )
}

function FlowStreamlines() {
  const lines = useMemo(() => {
    const result: [THREE.Vector3, THREE.Vector3][] = []
    for (let i = 0; i < 6; i++) {
      const y = -1.2 + (i / 5) * 2.4
      result.push([
        new THREE.Vector3(-ROAD_LENGTH / 2 + 0.5, 0.08, y),
        new THREE.Vector3(ROAD_LENGTH / 2 - 0.5, 0.08, y),
      ])
    }
    return result
  }, [])

  return (
    <>
      {lines.map((points, i) => (
        <Line
          key={i}
          points={points}
          color="#6366f1"
          transparent
          opacity={0.08 + (i % 2) * 0.03}
          lineWidth={1}
        />
      ))}
    </>
  )
}

function bottleneckFactor(x: number, progress: number): number {
  const center = 0
  const width = THREE.MathUtils.lerp(0.55, 2.2, smoothstep(progress))
  const dist = Math.abs(x - center)
  if (dist > width) return 1
  return THREE.MathUtils.lerp(0.25, 1, dist / width)
}

function TrafficVehicles({ progressRef }: { progressRef: React.RefObject<number | null> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])

  const cars = useMemo(() => {
    const result: CarState[] = []
    for (let lane = 0; lane < LANES; lane++) {
      for (let i = 0; i < CARS_PER_LANE; i++) {
        result.push({
          lane,
          offset: (i / CARS_PER_LANE) * ROAD_LENGTH - ROAD_LENGTH / 2,
          speedJitter: 0.85 + Math.random() * 0.3,
        })
      }
    }
    return result
  }, [])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    const p = smoothstep(progressRef.current ?? 0)
    const baseSpeed = THREE.MathUtils.lerp(1.8, 5.2, p)

    cars.forEach((car, i) => {
      car.offset += baseSpeed * car.speedJitter * bottleneckFactor(car.offset, p) * delta
      if (car.offset > ROAD_LENGTH / 2) car.offset = -ROAD_LENGTH / 2

      const laneY = (car.lane - 1) * 1.35
      dummy.position.set(car.offset, 0.12, laneY)
      dummy.rotation.set(0, Math.PI / 2, 0)
      dummy.scale.set(0.35, 0.18, 0.22)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      const speed = baseSpeed * car.speedJitter * bottleneckFactor(car.offset, p)
      const t = speed / 5.2
      color.setRGB(
        THREE.MathUtils.lerp(0.95, 0.2, t),
        THREE.MathUtils.lerp(0.35, 0.85, t),
        THREE.MathUtils.lerp(0.25, 0.45, t),
      )
      mesh.setColorAt(i, color)
    })

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, TOTAL_CARS]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial vertexColors metalness={0.35} roughness={0.45} />
    </instancedMesh>
  )
}

function CongestionHeatmap({ progressRef }: { progressRef: React.RefObject<number | null> }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)

  useFrame(() => {
    if (!matRef.current) return
    const p = smoothstep(progressRef.current ?? 0)
    matRef.current.color.setRGB(
      THREE.MathUtils.lerp(0.55, 0.12, p),
      THREE.MathUtils.lerp(0.12, 0.35, p),
      THREE.MathUtils.lerp(0.12, 0.55, p),
    )
    matRef.current.emissive.setRGB(
      THREE.MathUtils.lerp(0.35, 0.02, p),
      THREE.MathUtils.lerp(0.08, 0.08, p),
      THREE.MathUtils.lerp(0.05, 0.15, p),
    )
    matRef.current.emissiveIntensity = THREE.MathUtils.lerp(0.45, 0.1, p)
  })

  return (
    <mesh position={[0, 0.04, 0]}>
      <boxGeometry args={[1.1, 0.02, 2.6]} />
      <meshStandardMaterial ref={matRef} transparent opacity={0.55} />
    </mesh>
  )
}

function TrafficScene({
  progressRef,
  active,
}: {
  progressRef: React.RefObject<number | null>
  active: boolean
}) {
  if (!active) return null

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 8, 3]} intensity={0.9} />
      <directionalLight position={[-3, 4, -2]} intensity={0.2} color="#818cf8" />
      <CameraRig progressRef={progressRef} />
      <RoadSurface />
      <FlowStreamlines />
      <CongestionHeatmap progressRef={progressRef} />
      <TrafficVehicles progressRef={progressRef} />
    </>
  )
}

function getTelemetry(progress: number) {
  const p = smoothstep(progress)
  return {
    speed: `${THREE.MathUtils.lerp(42, 47.2, p).toFixed(1)} km/h`,
    density: p < 0.4 ? 'Congested' : p < 0.75 ? 'Moderate' : 'Optimal',
    jamReduction: `${Math.round(THREE.MathUtils.lerp(0, 42, p))}%`,
    phase: p < 0.5 ? 'Shockwave' : 'Dissipating',
  }
}

export interface FlowStateTrafficProps {
  scrollProgress?: number
  progress?: MotionValue<number>
  active?: boolean
  className?: string
}

export function FlowStateTraffic({
  scrollProgress = 0,
  progress,
  active = true,
  className = '',
}: FlowStateTrafficProps) {
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
        telemetry={
          <ViewerTelemetry
            label="Flow telemetry"
            rows={[
              { key: 'Avg speed', value: telemetry.speed },
              { key: 'Density', value: telemetry.density },
              { key: 'Jam ↓', value: telemetry.jamReduction },
              { key: 'Phase', value: telemetry.phase },
            ]}
          />
        }
        legend={
          <div className="research-viewer__legend">
            <span className="research-viewer__legend-item research-viewer__legend-item--slow">
              Congestion
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--fast">
              Free flow
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--flow">
              Flow →
            </span>
          </div>
        }
      >
        <Canvas
          camera={{ position: [-2, 9.5, 0.5], fov: 38, near: 0.1, far: 60 }}
          dpr={[1, 1.5]}
          gl={{ alpha: true, antialias: true }}
          frameloop={isVisible && active ? 'always' : 'demand'}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <TrafficScene progressRef={progressRef} active={isVisible && active} />
          </Suspense>
        </Canvas>
      </ResearchViewerFrame>
    </div>
  )
}
