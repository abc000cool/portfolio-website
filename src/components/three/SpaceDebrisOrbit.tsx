import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { useMotionValue, useMotionValueEvent, type MotionValue } from 'motion/react'
import * as THREE from 'three'
import { useIntersectionPause } from '../../hooks/useIntersectionPause'
import { useMotionProgressRef } from '../../hooks/useMotionProgressRef'
import { useThrottledMotionValue } from '../../hooks/useThrottledMotionValue'
import { smoothstep } from '../../lib/airfoilGeometry'
import {
  ConferenceBadgeOverlay,
  ResearchViewerFrame,
  ViewerTelemetry,
} from '../research/ResearchViewerFrame'

const DEBRIS_COUNT = 180
const EARTH_RADIUS = 1.42
const ORBIT_RADIUS = 2.7
const CAPTURE_COLOR = '#86efac'
const RAIL_COLOR = '#fbbf24'
const ORBIT_COLOR = '#818cf8'

type ProgressRef = React.RefObject<number | null>

function range01(value: number, start: number, end: number) {
  return THREE.MathUtils.clamp((value - start) / (end - start), 0, 1)
}

function deterministic(index: number, salt: number) {
  return ((Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453) % 1 + 1) % 1
}

function CameraRig({ progressRef }: { progressRef: ProgressRef }) {
  const { camera } = useThree()
  const positionRef = useRef(new THREE.Vector3())
  const targetRef = useRef(new THREE.Vector3())

  useFrame(() => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const intercept = smoothstep(range01(p, 0.18, 0.38))
    const operation = smoothstep(range01(p, 0.38, 0.72))
    const pullback = smoothstep(range01(p, 0.78, 1))
    const position = positionRef.current
    const target = targetRef.current

    position.set(
      THREE.MathUtils.lerp(4.6, 3.25, intercept) + pullback * 0.8,
      THREE.MathUtils.lerp(2.2, 1.35, intercept) + pullback * 0.4,
      THREE.MathUtils.lerp(5.4, 4.25, operation) + pullback * 0.55,
    )
    target.set(
      THREE.MathUtils.lerp(0, 0.68, intercept) - pullback * 0.4,
      THREE.MathUtils.lerp(0.05, 0.45, operation),
      0,
    )
    camera.position.lerp(position, 0.1)
    camera.lookAt(target)
  })
  return null
}

function Starfield() {
  const geometry = useMemo(() => {
    const positions = new Float32Array(420 * 3)
    for (let i = 0; i < 420; i++) {
      const radius = 7 + deterministic(i, 1) * 4
      const theta = deterministic(i, 2) * Math.PI * 2
      const phi = Math.acos(deterministic(i, 3) * 2 - 1)
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius
      positions[i * 3 + 1] = Math.cos(phi) * radius
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius
    }
    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return result
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#dbeafe" size={0.025} transparent opacity={0.72} sizeAttenuation />
    </points>
  )
}

function Earth() {
  const earthRef = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (earthRef.current) earthRef.current.rotation.y = state.clock.elapsedTime * 0.025
  })
  return (
    <group position={[-1.25, -1.42, -0.72]}>
      <mesh ref={earthRef}>
        <icosahedronGeometry args={[EARTH_RADIUS, 5]} />
        <meshPhysicalMaterial
          color="#102b5d"
          emissive="#06142e"
          emissiveIntensity={0.75}
          metalness={0.04}
          roughness={0.68}
          clearcoat={0.15}
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[EARTH_RADIUS * 1.035, 5]} />
        <meshBasicMaterial
          color="#60a5fa"
          transparent
          opacity={0.13}
          side={THREE.BackSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2.6, 0.2, -0.2]}>
        <torusGeometry args={[EARTH_RADIUS * 1.32, 0.012, 6, 128]} />
        <meshBasicMaterial color={ORBIT_COLOR} transparent opacity={0.34} />
      </mesh>
    </group>
  )
}

function OrbitShells() {
  const shells = useMemo(
    () =>
      [-0.18, 0.08, 0.28].map((inclination, shell) => {
        const points: THREE.Vector3[] = []
        const radius = ORBIT_RADIUS + shell * 0.22
        for (let i = 0; i <= 128; i++) {
          const angle = (i / 128) * Math.PI * 2
          points.push(
            new THREE.Vector3(
              Math.cos(angle) * radius - 1.25,
              Math.sin(angle) * radius * Math.sin(inclination) - 1.42,
              Math.sin(angle) * radius * Math.cos(inclination) - 0.72,
            ),
          )
        }
        return points
      }),
    [],
  )

  return (
    <>
      {shells.map((points, index) => (
        <Line
          key={index}
          points={points}
          color={index === 1 ? '#c7d2fe' : ORBIT_COLOR}
          transparent
          opacity={index === 1 ? 0.3 : 0.14}
          lineWidth={index === 1 ? 1.2 : 0.8}
        />
      ))}
    </>
  )
}

function DebrisField({ progressRef }: { progressRef: ProgressRef }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const glowRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const states = useMemo(
    () =>
      Array.from({ length: DEBRIS_COUNT }, (_, index) => ({
        angle: deterministic(index, 4) * Math.PI * 2,
        inclination: (deterministic(index, 5) - 0.5) * 0.62,
        radius: ORBIT_RADIUS + (deterministic(index, 6) - 0.5) * 0.62,
        scale: 0.025 + deterministic(index, 7) * 0.052,
        speed: 0.018 + deterministic(index, 8) * 0.024,
        spin: deterministic(index, 9) * Math.PI,
      })),
    [],
  )

  useFrame((state) => {
    const mesh = meshRef.current
    const glow = glowRef.current
    if (!mesh || !glow) return
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const tracking = smoothstep(range01(p, 0.1, 0.28))
    const cleared = smoothstep(range01(p, 0.42, 0.92))
    const time = state.clock.elapsedTime
    const trackedCount = Math.floor(tracking * 28)
    const clearedCount = Math.floor(cleared * 82)

    states.forEach((debris, index) => {
      const angle = debris.angle + time * debris.speed
      const visibleScale = index < clearedCount ? debris.scale * 0.04 : debris.scale
      dummy.position.set(
        Math.cos(angle) * debris.radius - 1.25,
        Math.sin(angle) * debris.radius * Math.sin(debris.inclination) - 1.42,
        Math.sin(angle) * debris.radius * Math.cos(debris.inclination) - 0.72,
      )
      dummy.rotation.set(debris.spin + time * 0.2, angle, debris.spin * 0.7)
      dummy.scale.set(visibleScale * 0.6, visibleScale * 1.8, visibleScale)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)

      const tracked = index < trackedCount && index >= clearedCount
      dummy.scale.setScalar(tracked ? visibleScale * 2.4 : 0.001)
      dummy.updateMatrix()
      glow.setMatrixAt(index, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    glow.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, DEBRIS_COUNT]}>
        <tetrahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#a8b2c3" metalness={0.86} roughness={0.32} />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[undefined, undefined, DEBRIS_COUNT]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          color={CAPTURE_COLOR}
          transparent
          opacity={0.18}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
    </>
  )
}

function CmgAssembly({ progressRef }: { progressRef: ProgressRef }) {
  const outerRef = useRef<THREE.Group>(null)
  const innerRef = useRef<THREE.Group>(null)
  useFrame((state) => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const stabilize = smoothstep(range01(p, 0.72, 0.9))
    if (outerRef.current) outerRef.current.rotation.x = state.clock.elapsedTime * (0.25 + stabilize * 3)
    if (innerRef.current) innerRef.current.rotation.y = -state.clock.elapsedTime * (0.2 + stabilize * 3.6)
  })
  return (
    <group position={[-0.38, 0, 0]}>
      <group ref={outerRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.19, 0.026, 8, 36]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.18} />
        </mesh>
      </group>
      <group ref={innerRef}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.13, 0.02, 8, 32]} />
          <meshStandardMaterial color={ORBIT_COLOR} emissive="#312e81" emissiveIntensity={0.8} />
        </mesh>
      </group>
    </group>
  )
}

function SweepVehicle({ progressRef }: { progressRef: ProgressRef }) {
  const rigRef = useRef<THREE.Group>(null)
  const chamberRef = useRef<THREE.MeshStandardMaterial>(null)
  const railRef = useRef<THREE.MeshStandardMaterial>(null)
  const targetRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const enter = smoothstep(range01(p, 0.22, 0.4))
    const compress = Math.sin(range01(p, 0.42, 0.58) * Math.PI)
    const fire = Math.sin(range01(p, 0.58, 0.72) * Math.PI)
    const recoil = smoothstep(range01(p, 0.6, 0.7)) * (1 - smoothstep(range01(p, 0.72, 0.82)))

    if (rigRef.current) {
      rigRef.current.position.set(
        THREE.MathUtils.lerp(2.3, 0.75, enter) - recoil * 0.12,
        THREE.MathUtils.lerp(1.15, 0.55, enter),
        THREE.MathUtils.lerp(0.8, 0, enter),
      )
      rigRef.current.rotation.y = THREE.MathUtils.lerp(-0.55, -0.12, enter)
    }
    if (chamberRef.current) chamberRef.current.emissiveIntensity = 0.25 + compress * 3.5
    if (railRef.current) railRef.current.emissiveIntensity = 0.4 + fire * 6
    if (targetRef.current) {
      const capture = smoothstep(range01(p, 0.28, 0.5))
      targetRef.current.position.x = THREE.MathUtils.lerp(1.35, 0.16, capture)
      targetRef.current.scale.setScalar(THREE.MathUtils.lerp(1, 0.08, capture))
      targetRef.current.rotation.x += 0.018
    }
  })

  return (
    <group ref={rigRef} position={[2.3, 1.15, 0.8]} rotation={[0, -0.55, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.38, 0.38, 1.18, 32, 1, true]} />
        <meshPhysicalMaterial
          color="#61728c"
          emissive="#101827"
          emissiveIntensity={0.45}
          metalness={0.84}
          roughness={0.22}
          clearcoat={0.42}
        />
      </mesh>
      <mesh position={[0.59, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.38, 0.045, 10, 40]} />
        <meshStandardMaterial color="#dbe4ee" metalness={0.92} roughness={0.16} />
      </mesh>
      <mesh position={[-0.59, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.38, 0.045, 10, 40]} />
        <meshStandardMaterial color="#dbe4ee" metalness={0.92} roughness={0.16} />
      </mesh>
      <mesh position={[0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.3, 0.3, 0.62, 32, 1, true]} />
        <meshStandardMaterial
          ref={chamberRef}
          color="#172033"
          emissive={CAPTURE_COLOR}
          emissiveIntensity={0.25}
          metalness={0.52}
          roughness={0.28}
          transparent
          opacity={0.82}
        />
      </mesh>
      <mesh ref={targetRef} position={[1.35, 0.1, 0]}>
        <octahedronGeometry args={[0.12, 0]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.25} />
      </mesh>
      <CmgAssembly progressRef={progressRef} />

      <group position={[0.42, -0.18, 0]}>
        {[-0.1, 0.1].map((z) => (
          <mesh key={z} position={[0, 0, z]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.06, 0.78, 0.045]} />
            <meshStandardMaterial
              ref={z < 0 ? railRef : undefined}
              color={RAIL_COLOR}
              emissive={RAIL_COLOR}
              emissiveIntensity={0.4}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
      <mesh position={[-0.18, 0, -0.56]}>
        <boxGeometry args={[0.64, 0.035, 0.58]} />
        <meshPhysicalMaterial color="#1e3a5f" metalness={0.65} roughness={0.3} clearcoat={0.5} />
      </mesh>
      <mesh position={[-0.18, 0, 0.56]}>
        <boxGeometry args={[0.64, 0.035, 0.58]} />
        <meshPhysicalMaterial color="#1e3a5f" metalness={0.65} roughness={0.3} clearcoat={0.5} />
      </mesh>
    </group>
  )
}

function MissionEffects({ progressRef }: { progressRef: ProgressRef }) {
  const interceptMaterial = useRef<THREE.LineBasicMaterial | null>(null)
  const ejectMaterial = useRef<THREE.LineBasicMaterial | null>(null)
  const pelletRef = useRef<THREE.Mesh>(null)

  const intercept = useMemo(
    () => [
      new THREE.Vector3(2.1, 1.1, 0.65),
      new THREE.Vector3(1.55, 0.9, 0.35),
      new THREE.Vector3(1.02, 0.62, 0.06),
    ],
    [],
  )
  const eject = useMemo(
    () => [
      new THREE.Vector3(1.1, 0.37, 0),
      new THREE.Vector3(1.65, 0.18, 0.15),
      new THREE.Vector3(2.55, -0.18, 0.46),
    ],
    [],
  )

  useFrame(() => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const scan = smoothstep(range01(p, 0.1, 0.3)) * (1 - smoothstep(range01(p, 0.42, 0.5)))
    const fire = smoothstep(range01(p, 0.58, 0.7))
    if (interceptMaterial.current) interceptMaterial.current.opacity = scan * 0.75
    if (ejectMaterial.current) ejectMaterial.current.opacity = fire * 0.85
    if (pelletRef.current) {
      pelletRef.current.visible = fire > 0.02
      pelletRef.current.position.lerpVectors(eject[0], eject[2], fire)
      pelletRef.current.scale.setScalar(0.04 + fire * 0.025)
    }
  })

  return (
    <>
      <Line
        points={intercept}
        color={CAPTURE_COLOR}
        transparent
        opacity={0}
        lineWidth={1.5}
        dashed
        dashSize={0.06}
        gapSize={0.045}
        onUpdate={(line: THREE.Line) => {
          interceptMaterial.current = line.material as THREE.LineBasicMaterial
        }}
      />
      <Line
        points={eject}
        color={RAIL_COLOR}
        transparent
        opacity={0}
        lineWidth={2}
        onUpdate={(line: THREE.Line) => {
          ejectMaterial.current = line.material as THREE.LineBasicMaterial
        }}
      />
      <mesh ref={pelletRef} visible={false}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial
          color="#fff7d6"
          emissive={RAIL_COLOR}
          emissiveIntensity={4}
          toneMapped={false}
        />
      </mesh>
    </>
  )
}

function DebrisScene({ progressRef }: { progressRef: ProgressRef }) {
  return (
    <>
      <color attach="background" args={['#030610']} />
      <fog attach="fog" args={['#030610', 7, 12]} />
      <ambientLight intensity={0.24} />
      <directionalLight position={[5, 6, 4]} intensity={1.65} color="#f8fafc" />
      <directionalLight position={[-4, 2, 3]} intensity={0.65} color={ORBIT_COLOR} />
      <pointLight position={[1, 1.2, 2]} intensity={0.8} color={CAPTURE_COLOR} distance={4} />
      <CameraRig progressRef={progressRef} />
      <Starfield />
      <Earth />
      <OrbitShells />
      <DebrisField progressRef={progressRef} />
      <SweepVehicle progressRef={progressRef} />
      <MissionEffects progressRef={progressRef} />
    </>
  )
}

function getTelemetry(progress: number) {
  const p = THREE.MathUtils.clamp(progress, 0, 1)
  let phase = 'Orbital survey'
  let detail = 'Cataloging LEO debris'
  let mode = 'SCAN'
  if (p >= 0.88) {
    phase = 'Mission reset'
    detail = 'Next target acquired'
    mode = 'READY'
  } else if (p >= 0.74) {
    phase = 'CMG stabilize'
    detail = 'Recoil cancellation'
    mode = 'ATTITUDE'
  } else if (p >= 0.58) {
    phase = 'Railgun eject'
    detail = 'Pellet disposal burn'
    mode = 'FIRE'
  } else if (p >= 0.42) {
    phase = 'Encapsulate'
    detail = 'Conductive compression'
    mode = 'PROCESS'
  } else if (p >= 0.28) {
    phase = 'Capture'
    detail = 'Tunnel intercept'
    mode = 'INGEST'
  } else if (p >= 0.1) {
    phase = 'Track'
    detail = 'Relative navigation'
    mode = 'TRACK'
  }
  return {
    phase,
    detail,
    mode,
    tracked: String(Math.round(847 - range01(p, 0.28, 0.88) * 612)),
    cleared: `${Math.round(range01(p, 0.42, 1) * 72)}%`,
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
        className={`${className} research-viewer--debris`}
        progressPercent={Math.round(liveProgress * 100)}
        badge={
          showConferenceBadge ? (
            <ConferenceBadgeOverlay conference="AAS" number="248" location="Pasadena, California" />
          ) : undefined
        }
        telemetry={
          <ViewerTelemetry
            label="SWEEP mission"
            rows={[
              { key: 'Phase', value: telemetry.phase },
              { key: 'Tracked', value: telemetry.tracked },
              { key: 'Altitude', value: '550 km' },
              { key: 'Cleared', value: telemetry.cleared },
              { key: 'Mode', value: telemetry.mode },
            ]}
          />
        }
        legend={
          <div className="research-viewer__legend">
            <span className="research-viewer__legend-item research-viewer__legend-item--capture">Target lock</span>
            <span className="research-viewer__legend-item research-viewer__legend-item--debris">Debris field</span>
            <span className="research-viewer__legend-item research-viewer__legend-item--rail">Rail ejection</span>
          </div>
        }
      >
        <Canvas
          camera={{ position: [4.6, 2.2, 5.4], fov: 40, near: 0.1, far: 30 }}
          dpr={[1, 1.5]}
          shadows
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
          frameloop={isVisible && active ? 'always' : 'demand'}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <DebrisScene progressRef={progressRef} />
          </Suspense>
        </Canvas>
        <div className="viewer-phase" aria-hidden="true">
          <span className="viewer-phase__index">{String(Math.min(5, Math.floor(liveProgress * 6)) + 1).padStart(2, '0')}</span>
          <span className="viewer-phase__copy"><strong>{telemetry.phase}</strong><small>{telemetry.detail}</small></span>
        </div>
      </ResearchViewerFrame>
    </div>
  )
}
