import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line, Text } from '@react-three/drei'
import { useMotionValueEvent, useMotionValue, type MotionValue } from 'motion/react'
import * as THREE from 'three'
import { useIntersectionPause } from '../../hooks/useIntersectionPause'
import { useMotionProgressRef } from '../../hooks/useMotionProgressRef'
import { useThrottledMotionValue } from '../../hooks/useThrottledMotionValue'
import { smoothstep } from '../../lib/airfoilGeometry'
import { ResearchViewerFrame, ViewerTelemetry } from '../research/ResearchViewerFrame'

const CLOUD_COUNT = 96
const ATOM_COLOR = '#a5b4fc'
const CLASSICAL_COLOR = '#fbbf24'
const HYBRID_COLOR = '#86efac'
const CAI_COLOR = '#818cf8'

function range01(p: number, a: number, b: number): number {
  if (b <= a) return p >= b ? 1 : 0
  return THREE.MathUtils.clamp((p - a) / (b - a), 0, 1)
}

function CameraRig({ progressRef }: { progressRef: React.RefObject<number | null> }) {
  const { camera } = useThree()
  const lookAt = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const p = smoothstep(progressRef.current ?? 0)
    const toHybrid = smoothstep(range01(p, 0.62, 0.72))

    const posA = new THREE.Vector3(0.15, 0.55, 4.6)
    const posB = new THREE.Vector3(1.35, 0.85, 4.2)
    camera.position.lerpVectors(posA, posB, toHybrid)

    lookAt.set(
      THREE.MathUtils.lerp(0, 0.55, toHybrid),
      THREE.MathUtils.lerp(0.1, 0.15, toHybrid),
      0,
    )
    camera.lookAt(lookAt)
  })

  return null
}

function Chamber() {
  return (
    <group position={[-0.85, 0.05, 0]}>
      <mesh>
        <cylinderGeometry args={[0.72, 0.72, 1.55, 28, 1, true]} />
        <meshBasicMaterial color="#64748b" transparent opacity={0.14} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.78, 0]}>
        <torusGeometry args={[0.72, 0.018, 8, 40]} />
        <meshBasicMaterial color="#94a3b8" transparent opacity={0.35} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.78, 0]}>
        <torusGeometry args={[0.72, 0.018, 8, 40]} />
        <meshBasicMaterial color="#94a3b8" transparent opacity={0.35} />
      </mesh>
      {/* Laser rails */}
      <mesh position={[0, 0.35, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 1.6, 8]} />
        <meshBasicMaterial color="#c7d2fe" transparent opacity={0.45} />
      </mesh>
      <mesh position={[0, -0.35, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 1.6, 8]} />
        <meshBasicMaterial color="#c7d2fe" transparent opacity={0.45} />
      </mesh>
    </group>
  )
}

function AtomCloud({ progressRef }: { progressRef: React.RefObject<number | null> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const seeds = useMemo(
    () =>
      Array.from({ length: CLOUD_COUNT }, () => ({
        theta: Math.random() * Math.PI * 2,
        phi: Math.acos(2 * Math.random() - 1),
        r: 0.08 + Math.random() * 0.28,
        path: Math.random() > 0.5 ? 1 : -1,
        jitter: Math.random() * Math.PI * 2,
      })),
    [],
  )

  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return
    const p = smoothstep(progressRef.current ?? 0)
    const settle = smoothstep(range01(p, 0, 0.12))
    const split = smoothstep(range01(p, 0.12, 0.28))
    const diverge = smoothstep(range01(p, 0.28, 0.42))
    const fold = smoothstep(range01(p, 0.42, 0.52))
    const recombine = smoothstep(range01(p, 0.52, 0.62))
    const fadeOut = 1 - smoothstep(range01(p, 0.62, 0.74))
    const t = state.clock.elapsedTime

    seeds.forEach((s, i) => {
      const baseR = s.r * THREE.MathUtils.lerp(1.35, 0.85, settle)
      let x = Math.sin(s.phi) * Math.cos(s.theta) * baseR - 0.85
      let y = Math.cos(s.phi) * baseR * 0.7
      let z = Math.sin(s.phi) * Math.sin(s.theta) * baseR

      const pathOffset = s.path * THREE.MathUtils.lerp(0, 0.55, split) * (1 - recombine * 0.85)
      const arc = Math.sin(diverge * Math.PI) * 0.22 * s.path
      x += pathOffset * 0.15
      y += pathOffset + arc * (1 - fold)
      z += Math.sin(t * 0.8 + s.jitter) * 0.02 * settle

      const scale = 0.018 * settle * fadeOut * (0.85 + 0.15 * Math.sin(t * 2 + s.jitter))
      dummy.position.set(x, y, z)
      dummy.scale.setScalar(Math.max(0.001, scale))
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.visible = fadeOut > 0.02
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, CLOUD_COUNT]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={ATOM_COLOR} transparent opacity={0.85} />
    </instancedMesh>
  )
}

function MatterPaths({ progressRef }: { progressRef: React.RefObject<number | null> }) {
  const upperRef = useRef<THREE.Group>(null)
  const lowerRef = useRef<THREE.Group>(null)
  const phaseRef = useRef<THREE.Group>(null)

  const upperPts = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 32; i++) {
      const u = i / 32
      pts.push(new THREE.Vector3(-1.35 + u * 1.0, 0.08 + Math.sin(u * Math.PI) * 0.55, 0))
    }
    return pts
  }, [])

  const lowerPts = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 32; i++) {
      const u = i / 32
      pts.push(new THREE.Vector3(-1.35 + u * 1.0, -0.08 - Math.sin(u * Math.PI) * 0.55, 0))
    }
    return pts
  }, [])

  useFrame(() => {
    const p = smoothstep(progressRef.current ?? 0)
    const show = smoothstep(range01(p, 0.14, 0.3)) * (1 - smoothstep(range01(p, 0.6, 0.72)))
    const fold = smoothstep(range01(p, 0.42, 0.52))
    if (upperRef.current) {
      upperRef.current.scale.y = THREE.MathUtils.lerp(1, 0.35, fold)
      upperRef.current.visible = show > 0.02
    }
    if (lowerRef.current) {
      lowerRef.current.scale.y = THREE.MathUtils.lerp(1, 0.35, fold)
      lowerRef.current.visible = show > 0.02
    }
    if (phaseRef.current) {
      const phaseVis = smoothstep(range01(p, 0.3, 0.4)) * (1 - smoothstep(range01(p, 0.58, 0.68)))
      phaseRef.current.visible = phaseVis > 0.05
      phaseRef.current.position.y = 0.95
    }
  })

  return (
    <group>
      <group ref={upperRef}>
        <Line points={upperPts} color={ATOM_COLOR} transparent opacity={0.55} lineWidth={1.5} />
      </group>
      <group ref={lowerRef}>
        <Line points={lowerPts} color="#c4b5fd" transparent opacity={0.55} lineWidth={1.5} />
      </group>
      <group ref={phaseRef} position={[-0.7, 0.95, 0]}>
        <Text
          fontSize={0.11}
          color="#c7d2fe"
          anchorX="center"
          anchorY="middle"
          fillOpacity={0.9}
        >
          φ = k_eff a T²
        </Text>
      </group>
    </group>
  )
}

function PulsePlanes({ progressRef }: { progressRef: React.RefObject<number | null> }) {
  const p1 = useRef<THREE.Mesh>(null)
  const p2 = useRef<THREE.Mesh>(null)
  const p3 = useRef<THREE.Mesh>(null)
  const fringe = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const p = smoothstep(progressRef.current ?? 0)
    const pulse = (start: number, end: number) => {
      const t = range01(p, start, end)
      const flash = Math.sin(t * Math.PI)
      return flash * (1 - smoothstep(range01(p, 0.62, 0.72)))
    }
    const a = pulse(0.12, 0.28)
    const b = pulse(0.42, 0.52)
    const c = pulse(0.52, 0.62)
    const fringeFlash = Math.sin(range01(p, 0.54, 0.62) * Math.PI) * (1 - range01(p, 0.62, 0.7))

    if (p1.current) {
      p1.current.visible = a > 0.02
      ;(p1.current.material as THREE.MeshBasicMaterial).opacity = 0.15 + a * 0.55
      p1.current.scale.setScalar(0.85 + a * 0.25)
    }
    if (p2.current) {
      p2.current.visible = b > 0.02
      ;(p2.current.material as THREE.MeshBasicMaterial).opacity = 0.15 + b * 0.55
      p2.current.scale.setScalar(0.85 + b * 0.25)
    }
    if (p3.current) {
      p3.current.visible = c > 0.02
      ;(p3.current.material as THREE.MeshBasicMaterial).opacity = 0.15 + c * 0.55
      p3.current.scale.setScalar(0.85 + c * 0.25)
    }
    if (fringe.current) {
      fringe.current.visible = fringeFlash > 0.02
      ;(fringe.current.material as THREE.MeshBasicMaterial).opacity = fringeFlash * 0.7
      fringe.current.rotation.z = state.clock.elapsedTime * 1.2
    }
  })

  return (
    <group position={[-0.85, 0, 0]}>
      <mesh ref={p1} position={[-0.35, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.2, 1.2]} />
        <meshBasicMaterial color="#818cf8" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={p2} position={[0, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.2, 1.2]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={p3} position={[0.35, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.2, 1.2]} />
        <meshBasicMaterial color="#c4b5fd" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={fringe} position={[0.55, 0, 0]}>
        <ringGeometry args={[0.12, 0.38, 48]} />
        <meshBasicMaterial color="#e0e7ff" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}

function ImuTriad({ progressRef }: { progressRef: React.RefObject<number | null> }) {
  const group = useRef<THREE.Group>(null)

  useFrame((state) => {
    const p = smoothstep(progressRef.current ?? 0)
    const show = smoothstep(range01(p, 0.62, 0.72))
    if (!group.current) return
    group.current.visible = show > 0.02
    group.current.scale.setScalar(0.001 + show * 0.999)
    group.current.rotation.y = state.clock.elapsedTime * 0.35
    const drift = range01(p, 0.66, 0.78)
    group.current.position.x = 0.95 + Math.sin(state.clock.elapsedTime * 1.4) * 0.03 * drift
  })

  return (
    <group ref={group} position={[0.95, 0.15, 0]}>
      <mesh>
        <boxGeometry args={[0.28, 0.28, 0.28]} />
        <meshBasicMaterial color="#1e293b" transparent opacity={0.85} />
      </mesh>
      <mesh position={[0.22, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.04, 0.22, 8]} />
        <meshBasicMaterial color="#f87171" />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <coneGeometry args={[0.04, 0.22, 8]} />
        <meshBasicMaterial color="#86efac" />
      </mesh>
      <mesh position={[0, 0, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.04, 0.22, 8]} />
        <meshBasicMaterial color="#60a5fa" />
      </mesh>
      <Text position={[0, -0.42, 0]} fontSize={0.09} color={CLASSICAL_COLOR} anchorX="center">
        Classical IMU
      </Text>
    </group>
  )
}

function ErrorRibbons({ progressRef }: { progressRef: React.RefObject<number | null> }) {
  const classicalRef = useRef<THREE.Mesh>(null)
  const hybridRef = useRef<THREE.Mesh>(null)
  const classicalLine = useRef<THREE.Group>(null)
  const hybridLine = useRef<THREE.Group>(null)

  const classicalPts = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 40; i++) {
      const u = i / 40
      pts.push(new THREE.Vector3(0.55 + u * 1.4, 0.05 + u * u * 1.15, 0.05))
    }
    return pts
  }, [])

  const hybridPts = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 40; i++) {
      const u = i / 40
      pts.push(new THREE.Vector3(0.55 + u * 1.4, 0.02 + Math.sin(u * Math.PI * 2) * 0.04 + u * 0.08, -0.05))
    }
    return pts
  }, [])

  useFrame(() => {
    const p = smoothstep(progressRef.current ?? 0)
    const show = smoothstep(range01(p, 0.64, 0.74))
    const grow = smoothstep(range01(p, 0.66, 0.8))
    const lock = smoothstep(range01(p, 0.78, 0.92))

    if (classicalLine.current) {
      classicalLine.current.visible = show > 0.02
      classicalLine.current.scale.x = Math.max(0.001, grow)
      classicalLine.current.scale.y = THREE.MathUtils.lerp(1, 0.35, lock)
    }
    if (hybridLine.current) {
      hybridLine.current.visible = show > 0.02
      hybridLine.current.scale.x = Math.max(0.001, grow)
    }
    if (classicalRef.current) {
      classicalRef.current.visible = show > 0.02
      const radius = THREE.MathUtils.lerp(0.08, 0.42, grow) * THREE.MathUtils.lerp(1, 0.4, lock)
      classicalRef.current.scale.setScalar(Math.max(0.001, radius / 0.42))
      ;(classicalRef.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + grow * 0.2
    }
    if (hybridRef.current) {
      hybridRef.current.visible = show > 0.02
      const radius = THREE.MathUtils.lerp(0.08, 0.14, grow)
      hybridRef.current.scale.setScalar(Math.max(0.001, radius / 0.14))
      ;(hybridRef.current.material as THREE.MeshBasicMaterial).opacity = 0.22 + lock * 0.35
    }
  })

  return (
    <group>
      <group ref={classicalLine}>
        <Line points={classicalPts} color={CLASSICAL_COLOR} transparent opacity={0.7} lineWidth={1.5} />
      </group>
      <group ref={hybridLine}>
        <Line points={hybridPts} color={HYBRID_COLOR} transparent opacity={0.85} lineWidth={1.5} />
      </group>
      <mesh ref={classicalRef} position={[1.85, 1.05, 0.05]}>
        <sphereGeometry args={[0.42, 16, 16]} />
        <meshBasicMaterial color={CLASSICAL_COLOR} transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <mesh ref={hybridRef} position={[1.85, 0.12, -0.05]}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshBasicMaterial color={HYBRID_COLOR} transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </group>
  )
}

function CaiShots({ progressRef }: { progressRef: React.RefObject<number | null> }) {
  const bolts = useRef<THREE.Group>(null)

  useFrame((state) => {
    const p = smoothstep(progressRef.current ?? 0)
    const fire = smoothstep(range01(p, 0.72, 0.88))
    if (!bolts.current) return
    bolts.current.visible = fire > 0.02
    const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 8)
    bolts.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.opacity = fire * (0.35 + pulse * 0.45) * (1 - i * 0.15)
      mesh.scale.setScalar(0.7 + fire * 0.5 + pulse * 0.1)
    })
  })

  return (
    <group ref={bolts}>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[-0.2 + i * 0.35, 0.05, 0]}
          rotation={[0, 0, -0.35]}
        >
          <cylinderGeometry args={[0.015, 0.015, 1.1 - i * 0.1, 6]} />
          <meshBasicMaterial color={CAI_COLOR} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[0.55, 0.12, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshBasicMaterial color={HYBRID_COLOR} transparent opacity={0} />
      </mesh>
      <group position={[0.55, -0.35, 0]}>
        <Text fontSize={0.08} color={HYBRID_COLOR} anchorX="center">
          EKF lock
        </Text>
      </group>
    </group>
  )
}

function HybridLabels({ progressRef }: { progressRef: React.RefObject<number | null> }) {
  const group = useRef<THREE.Group>(null)

  useFrame(() => {
    const p = smoothstep(progressRef.current ?? 0)
    const show = smoothstep(range01(p, 0.86, 0.95))
    if (!group.current) return
    group.current.visible = show > 0.05
    group.current.scale.setScalar(Math.max(0.001, show))
  })

  return (
    <group ref={group} position={[1.85, -0.55, 0]}>
      <Text fontSize={0.085} color={CLASSICAL_COLOR} anchorX="center" position={[0, 0.12, 0]}>
        Classical drift ↑
      </Text>
      <Text fontSize={0.085} color={HYBRID_COLOR} anchorX="center" position={[0, -0.05, 0]}>
        Hybrid locked
      </Text>
    </group>
  )
}

function QcinScene({
  progressRef,
}: {
  progressRef: React.RefObject<number | null>
  active: boolean
}) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <pointLight position={[2, 3, 4]} intensity={0.8} color="#c7d2fe" />
      <pointLight position={[-2, 1, 2]} intensity={0.35} color="#818cf8" />
      <CameraRig progressRef={progressRef} />
      <Chamber />
      <AtomCloud progressRef={progressRef} />
      <MatterPaths progressRef={progressRef} />
      <PulsePlanes progressRef={progressRef} />
      <ImuTriad progressRef={progressRef} />
      <ErrorRibbons progressRef={progressRef} />
      <CaiShots progressRef={progressRef} />
      <HybridLabels progressRef={progressRef} />
    </>
  )
}

function getTelemetry(progress: number) {
  const p = smoothstep(progress)
  let phase = 'Cool'
  if (p >= 0.88) phase = 'Hybrid lock'
  else if (p >= 0.72) phase = 'CAI update'
  else if (p >= 0.62) phase = 'IMU drift'
  else if (p >= 0.52) phase = 'Recombine'
  else if (p >= 0.42) phase = 'π mirror'
  else if (p >= 0.28) phase = 'Free fall'
  else if (p >= 0.12) phase = 'π/2 split'
  else if (p >= 0.02) phase = 'Cool'

  const shots = Math.round(THREE.MathUtils.lerp(0, 48, range01(p, 0.72, 0.92)))
  const classicalBias = THREE.MathUtils.lerp(12, 840, range01(p, 0.64, 0.8)) * (1 - 0.55 * range01(p, 0.8, 0.95))
  const hybridBias = THREE.MathUtils.lerp(12, 28, range01(p, 0.64, 0.78)) * (1 - 0.7 * range01(p, 0.78, 0.95))
  const mode = p >= 0.72 ? 'HYBRID' : p >= 0.12 ? 'CAI' : 'IDLE'

  return {
    phase,
    shots: String(shots),
    classical: `${Math.round(classicalBias)} µg`,
    hybrid: `${Math.round(hybridBias)} µg`,
    mode,
  }
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
  const progressRef = useMotionProgressRef(progress, scrollProgress)
  const fallbackProgress = useMotionValue(scrollProgress)
  const source = progress ?? fallbackProgress
  const liveProgress = useThrottledMotionValue(source, 150)

  useEffect(() => {
    if (!progress) fallbackProgress.set(scrollProgress)
  }, [progress, scrollProgress, fallbackProgress])

  useEffect(() => {
    progressRef.current = progress?.get() ?? scrollProgress
  }, [progress, scrollProgress, progressRef])

  useMotionValueEvent(source, 'change', (v) => {
    progressRef.current = v
  })

  const telemetry = getTelemetry(liveProgress)

  return (
    <div ref={containerRef}>
      <ResearchViewerFrame
        className={className}
        progressPercent={Math.round(liveProgress * 100)}
        telemetry={
          <ViewerTelemetry
            label="QCIN telemetry"
            rows={[
              { key: 'Phase', value: telemetry.phase },
              { key: 'Atom shots', value: telemetry.shots },
              { key: 'Classical bias', value: telemetry.classical },
              { key: 'Hybrid bias', value: telemetry.hybrid },
              { key: 'Mode', value: telemetry.mode },
            ]}
          />
        }
        legend={
          <div className="research-viewer__legend">
            <span className="research-viewer__legend-item research-viewer__legend-item--qcin-atom">
              Atom path
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--qcin-classical">
              Classical IMU
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
          camera={{ position: [0.15, 0.55, 4.6], fov: 42, near: 0.1, far: 80 }}
          dpr={[1, 1.5]}
          gl={{ alpha: true, antialias: true }}
          frameloop={isVisible && active ? 'always' : 'demand'}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <QcinScene progressRef={progressRef} active={isVisible && active} />
          </Suspense>
        </Canvas>
      </ResearchViewerFrame>
    </div>
  )
}
