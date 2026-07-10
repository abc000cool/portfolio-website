import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, Line } from '@react-three/drei'
import { useMotionValue, useMotionValueEvent, type MotionValue } from 'motion/react'
import * as THREE from 'three'
import { useIntersectionPause } from '../../hooks/useIntersectionPause'
import { useMotionProgressRef } from '../../hooks/useMotionProgressRef'
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

function CameraRig({ progressRef }: { progressRef: ProgressRef }) {
  const { camera } = useThree()
  const positionRef = useRef(new THREE.Vector3())
  const targetRef = useRef(new THREE.Vector3())

  useFrame(() => {
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

    camera.position.lerp(position, 0.12)
    camera.lookAt(target)
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
}: {
  packet: 'upper' | 'lower'
  progressRef: ProgressRef
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const glowRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const seeds = useMemo(() => deterministicSeeds(ATOMS_PER_PACKET), [])
  const sign = packet === 'upper' ? 1 : -1

  useFrame((state) => {
    const mesh = meshRef.current
    const glow = glowRef.current
    if (!mesh || !glow) return

    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const cool = smoothstep(range01(p, 0, 0.12))
    const handoff = smoothstep(range01(p, 0.62, 0.72))
    const time = state.clock.elapsedTime

    let separation = 0
    let centerY = THREE.MathUtils.lerp(-0.16, -0.12, cool)
    if (p >= 0.12 && p < 0.28) {
      const phase = smoothstep(range01(p, 0.12, 0.28))
      separation = THREE.MathUtils.lerp(0, 0.25, phase)
      centerY = THREE.MathUtils.lerp(-0.12, 0.02, phase)
    } else if (p >= 0.28 && p < 0.42) {
      const phase = smoothstep(range01(p, 0.28, 0.42))
      separation = 0.25
      centerY = THREE.MathUtils.lerp(0.02, 0.2, phase)
    } else if (p >= 0.42 && p < 0.52) {
      const phase = smoothstep(range01(p, 0.42, 0.52))
      separation = THREE.MathUtils.lerp(0.25, 0.18, phase)
      centerY = THREE.MathUtils.lerp(0.2, 0.36, phase)
    } else if (p >= 0.52) {
      const phase = smoothstep(range01(p, 0.52, 0.62))
      separation = THREE.MathUtils.lerp(0.18, 0, phase)
      centerY = THREE.MathUtils.lerp(0.36, 0.52, phase)
    }

    const centerX = -0.92 + sign * separation

    const packetRadius = THREE.MathUtils.lerp(0.16, 0.09, cool)
    const opacity = THREE.MathUtils.lerp(0.96, 0.18, handoff)

    seeds.forEach((seed, index) => {
      const breathe = 1 + Math.sin(time * 1.5 + seed.phase * Math.PI * 2) * 0.035
      dummy.position.set(
        centerX + seed.x * packetRadius * breathe,
        centerY + seed.y * packetRadius * 0.72 * breathe,
        seed.z * packetRadius * 0.6 + 0.22,
      )
      dummy.scale.setScalar(0.019 * seed.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)

      dummy.scale.setScalar(0.038 * seed.scale)
      dummy.updateMatrix()
      glow.setMatrixAt(index, dummy.matrix)
    })

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
}: {
  progressRef: ProgressRef
  phase: [number, number]
  y: number
}) {
  const groupRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.MeshStandardMaterial>(null)
  const haloRef = useRef<THREE.MeshBasicMaterial>(null)

  useFrame(() => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const pulse = pulseWindow(p, phase[0], phase[1])
    if (!groupRef.current || !coreRef.current || !haloRef.current) return
    groupRef.current.visible = pulse > 0.025
    groupRef.current.scale.x = 0.65 + pulse * 0.45
    coreRef.current.emissiveIntensity = 1 + pulse * 4
    coreRef.current.opacity = pulse * 0.95
    haloRef.current.opacity = pulse * 0.16
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

  useFrame(() => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const fringe = pulseWindow(p, 0.52, 0.65)
    if (!groupRef.current || !detectorMaterial.current) return
    groupRef.current.visible = fringe > 0.02
    detectorMaterial.current.emissiveIntensity = 0.3 + fringe * 3.5
    bars.current.forEach((bar, index) => {
      const material = bar.material as THREE.MeshBasicMaterial
      material.opacity = fringe * (index % 2 === 0 ? 0.8 : 0.28)
      bar.scale.y = 0.65 + fringe * 0.35
    })
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

function AvionicsModule({ progressRef }: { progressRef: ProgressRef }) {
  const groupRef = useRef<THREE.Group>(null)
  const lockLightRef = useRef<THREE.MeshStandardMaterial>(null)
  const imuRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const reveal = smoothstep(range01(p, 0.58, 0.72))
    const drift = smoothstep(range01(p, 0.62, 0.78))
    const lock = smoothstep(range01(p, 0.84, 0.96))
    if (groupRef.current) {
      groupRef.current.visible = reveal > 0.015
      groupRef.current.position.y = THREE.MathUtils.lerp(-0.08, 0, reveal)
    }
    if (imuRef.current) {
      imuRef.current.rotation.z =
        Math.sin(state.clock.elapsedTime * 2.2) * 0.018 * drift * (1 - lock)
    }
    if (lockLightRef.current) {
      lockLightRef.current.color.set(lock > 0.5 ? HYBRID_COLOR : CLASSICAL_COLOR)
      lockLightRef.current.emissive.set(lock > 0.5 ? HYBRID_COLOR : CLASSICAL_COLOR)
      lockLightRef.current.emissiveIntensity = 0.8 + lock * 3.2
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

function FusionBus({ progressRef }: { progressRef: ProgressRef }) {
  const groupRef = useRef<THREE.Group>(null)
  const packets = useRef<THREE.Mesh[]>([])
  const busMaterial = useRef<THREE.LineBasicMaterial | null>(null)
  const start = useMemo(() => new THREE.Vector3(-0.25, -0.2, 0.28), [])
  const finish = useMemo(() => new THREE.Vector3(0.86, -0.2, 0.28), [])

  useFrame(() => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const reveal = smoothstep(range01(p, 0.64, 0.74))
    const update = smoothstep(range01(p, 0.72, 0.88))
    const locked = smoothstep(range01(p, 0.88, 1))
    if (groupRef.current) groupRef.current.visible = reveal > 0.02
    if (busMaterial.current) busMaterial.current.opacity = reveal * (0.35 + locked * 0.35)

    packets.current.forEach((packet, index) => {
      const cycle = (update * 3.1 - index * 0.34) % 1
      const visible = update > index * 0.08 && cycle > 0.02 && cycle < 0.98 && locked < 0.98
      packet.visible = visible
      if (!visible) return
      packet.position.lerpVectors(start, finish, cycle)
      packet.rotation.z = Math.PI / 4
      const material = packet.material as THREE.MeshStandardMaterial
      material.emissiveIntensity = 2.4 + Math.sin(cycle * Math.PI) * 2
    })
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

function UncertaintyEnvelope({ progressRef }: { progressRef: ProgressRef }) {
  const groupRef = useRef<THREE.Group>(null)
  const classicalRef = useRef<THREE.Mesh>(null)
  const hybridRef = useRef<THREE.Mesh>(null)
  const trajectoryMaterial = useRef<THREE.LineBasicMaterial | null>(null)

  useFrame(() => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const reveal = smoothstep(range01(p, 0.62, 0.73))
    const drift = smoothstep(range01(p, 0.65, 0.82))
    const lock = smoothstep(range01(p, 0.82, 0.97))
    if (groupRef.current) groupRef.current.visible = reveal > 0.02
    if (trajectoryMaterial.current) trajectoryMaterial.current.opacity = reveal * 0.52

    if (classicalRef.current) {
      classicalRef.current.scale.y = 0.15 + drift * 0.85
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

function HybridNavigatorRig({ progressRef }: { progressRef: ProgressRef }) {
  return (
    <group position={[0, 0.03, 0]}>
      <InstrumentStage />
      <VacuumChamber />
      <OpticalBench />
      <MatterWavePaths progressRef={progressRef} />
      <AtomPacket packet="upper" progressRef={progressRef} />
      <AtomPacket packet="lower" progressRef={progressRef} />
      <RamanPulse progressRef={progressRef} phase={[0.12, 0.28]} y={-0.2} />
      <RamanPulse progressRef={progressRef} phase={[0.42, 0.52]} y={0.24} />
      <RamanPulse progressRef={progressRef} phase={[0.52, 0.62]} y={0.57} />
      <FringeDetector progressRef={progressRef} />
      <AvionicsModule progressRef={progressRef} />
      <FusionBus progressRef={progressRef} />
      <UncertaintyEnvelope progressRef={progressRef} />
    </group>
  )
}

function QcinScene({ progressRef }: { progressRef: ProgressRef }) {
  return (
    <>
      <color attach="background" args={['#040711']} />
      <fog attach="fog" args={['#040711', 6.5, 10]} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[4, 5, 5]} intensity={1.8} color="#f8fafc" castShadow />
      <directionalLight position={[-4, 2, 3]} intensity={0.75} color="#818cf8" />
      <pointLight position={[-0.9, 0.2, 1.7]} intensity={1.4} color="#a5b4fc" distance={4} />
      <pointLight position={[1.1, 0, 1.4]} intensity={0.7} color="#86efac" distance={3} />
      <CameraRig progressRef={progressRef} />
      <HybridNavigatorRig progressRef={progressRef} />
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
        className={`${className} research-viewer--qcin`}
        progressPercent={Math.round(liveProgress * 100)}
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
            <QcinScene progressRef={progressRef} />
          </Suspense>
        </Canvas>
        <div className="qcin-phase" aria-hidden="true">
          <span className="qcin-phase__index">
            {String(Math.min(7, Math.floor(liveProgress * 8)) + 1).padStart(2, '0')}
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
