import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { useMotionValue, useMotionValueEvent, type MotionValue } from 'motion/react'
import * as THREE from 'three'
import { useIntersectionPause } from '../../hooks/useIntersectionPause'
import { useMotionProgressRef } from '../../hooks/useMotionProgressRef'
import { useThrottledMotionValue } from '../../hooks/useThrottledMotionValue'
import { smoothstep } from '../../lib/airfoilGeometry'
import { ResearchViewerFrame, ViewerTelemetry } from '../research/ResearchViewerFrame'

const ROAD_LENGTH = 12
const LANES = 3
const CARS_PER_LANE = 20
const TOTAL_CARS = LANES * CARS_PER_LANE
const CONGESTION_COLOR = '#f87171'
const GUIDANCE_COLOR = '#22d3ee'
const FREE_FLOW_COLOR = '#86efac'
const CFD_COLOR = '#818cf8'

type ProgressRef = React.RefObject<number | null>

interface CarState {
  lane: number
  offset: number
  speed: number
  connected: boolean
}

function range01(value: number, start: number, end: number) {
  return THREE.MathUtils.clamp((value - start) / (end - start), 0, 1)
}

function deterministic(index: number, salt: number) {
  return ((Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453) % 1 + 1) % 1
}

function buildVehicleGeometry() {
  const profile = new THREE.Shape()
  profile.moveTo(-0.48, 0)
  profile.lineTo(-0.4, 0.13)
  profile.lineTo(-0.19, 0.27)
  profile.lineTo(0.2, 0.27)
  profile.lineTo(0.43, 0.12)
  profile.lineTo(0.48, 0)
  profile.closePath()
  const geometry = new THREE.ExtrudeGeometry(profile, {
    depth: 0.34,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.035,
    bevelThickness: 0.035,
  })
  geometry.translate(0, 0, -0.17)
  geometry.computeVertexNormals()
  return geometry
}

function CameraRig({ progressRef }: { progressRef: ProgressRef }) {
  const { camera } = useThree()
  const positionRef = useRef(new THREE.Vector3())
  const targetRef = useRef(new THREE.Vector3())
  useFrame(() => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const diagnose = smoothstep(range01(p, 0.08, 0.38))
    const intervene = smoothstep(range01(p, 0.52, 0.76))
    const settle = smoothstep(range01(p, 0.84, 1))
    const position = positionRef.current
    const target = targetRef.current
    position.set(
      THREE.MathUtils.lerp(-4.2, -1.3, diagnose) + intervene * 1.2 + settle * 0.8,
      THREE.MathUtils.lerp(5.8, 3.45, diagnose) + settle * 0.45,
      THREE.MathUtils.lerp(5.4, 4.25, diagnose) + intervene * 0.3,
    )
    target.set(
      THREE.MathUtils.lerp(-0.8, 0.25, intervene),
      0,
      THREE.MathUtils.lerp(0.1, -0.1, diagnose),
    )
    camera.position.lerp(position, 0.1)
    camera.lookAt(target)
  })
  return null
}

function CorridorStage() {
  return (
    <group>
      <mesh position={[0, -0.3, 0]} receiveShadow>
        <boxGeometry args={[ROAD_LENGTH + 0.8, 0.42, 5.25]} />
        <meshPhysicalMaterial color="#111827" metalness={0.68} roughness={0.34} clearcoat={0.18} />
      </mesh>
      <mesh position={[0, -0.53, 0]}>
        <boxGeometry args={[ROAD_LENGTH + 1.4, 0.08, 5.75]} />
        <meshStandardMaterial color="#070b13" metalness={0.55} roughness={0.45} />
      </mesh>
      {[-2.42, 2.42].map((z) => (
        <group key={z} position={[0, 0.03, z]}>
          <mesh>
            <boxGeometry args={[ROAD_LENGTH, 0.13, 0.09]} />
            <meshStandardMaterial color="#64748b" metalness={0.86} roughness={0.22} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <boxGeometry args={[ROAD_LENGTH, 0.025, 0.025]} />
            <meshStandardMaterial
              color={CFD_COLOR}
              emissive={CFD_COLOR}
              emissiveIntensity={0.65}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function RoadField({ progressRef }: { progressRef: ProgressRef }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  useFrame((state) => {
    if (!materialRef.current) return
    materialRef.current.uniforms.uProgress.value = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
      <planeGeometry args={[ROAD_LENGTH, 4.65, 80, 8]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={{
          uProgress: { value: 0 },
          uTime: { value: 0 },
        }}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uProgress;
          uniform float uTime;
          varying vec2 vUv;
          float ease(float x) { return x * x * (3.0 - 2.0 * x); }
          void main() {
            float jamBuild = ease(clamp((uProgress - 0.10) / 0.28, 0.0, 1.0));
            float recovery = ease(clamp((uProgress - 0.55) / 0.38, 0.0, 1.0));
            float center = exp(-pow((vUv.x - 0.50) * 7.0, 2.0));
            float upstream = smoothstep(0.50, 0.12, vUv.x);
            float jam = center * 0.65 + upstream * 0.55;
            jam *= jamBuild * (1.0 - recovery);
            vec3 asphalt = vec3(0.035, 0.055, 0.095);
            vec3 congested = mix(vec3(0.95, 0.25, 0.18), vec3(0.98, 0.65, 0.12), vUv.y);
            vec3 optimal = mix(vec3(0.06, 0.32, 0.50), vec3(0.08, 0.58, 0.46), vUv.x);
            vec3 color = mix(asphalt, congested, jam * 0.72);
            color = mix(color, optimal, recovery * 0.42);
            float contour = sin(vUv.x * 90.0 - uTime * 3.0) * 0.5 + 0.5;
            color += vec3(0.18, 0.22, 0.55) * contour * 0.05 * (jamBuild + recovery);
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  )
}

function LaneInfrastructure() {
  const laneZ = [-1.55, 0, 1.55]
  return (
    <group>
      {laneZ.slice(0, 2).map((z) => (
        <Line
          key={z}
          points={[[-ROAD_LENGTH / 2, 0.015, z + 0.77], [ROAD_LENGTH / 2, 0.015, z + 0.77]]}
          color="#cbd5e1"
          transparent
          opacity={0.34}
          lineWidth={1.2}
          dashed
          dashSize={0.22}
          gapSize={0.18}
        />
      ))}
      {[-2.25, 2.25].map((z) => (
        <Line
          key={z}
          points={[[-ROAD_LENGTH / 2, 0.018, z], [ROAD_LENGTH / 2, 0.018, z]]}
          color="#f8fafc"
          transparent
          opacity={0.48}
          lineWidth={1.4}
        />
      ))}
      <mesh position={[-0.15, 0.035, -1.55]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.3, 1.35]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.08} depthWrite={false} />
      </mesh>
      {Array.from({ length: 8 }, (_, index) => (
        <mesh
          key={index}
          position={[-1.1 + index * 0.3, 0.045, -1.55 + index * 0.035]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.18, 0.035]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.6} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

function Gantry({ progressRef }: { progressRef: ProgressRef }) {
  const signMaterial = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(() => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const guidance = smoothstep(range01(p, 0.52, 0.75))
    if (signMaterial.current) {
      signMaterial.current.color.set(guidance > 0.5 ? FREE_FLOW_COLOR : CONGESTION_COLOR)
      signMaterial.current.emissive.set(guidance > 0.5 ? FREE_FLOW_COLOR : CONGESTION_COLOR)
      signMaterial.current.emissiveIntensity = 0.8 + guidance * 2
    }
  })
  return (
    <group position={[0.35, 0, 0]}>
      {[-2.35, 2.35].map((z) => (
        <mesh key={z} position={[0, 0.95, z]}>
          <boxGeometry args={[0.09, 2, 0.09]} />
          <meshStandardMaterial color="#64748b" metalness={0.88} roughness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, 1.9, 0]}>
        <boxGeometry args={[0.12, 0.12, 4.8]} />
        <meshStandardMaterial color="#64748b" metalness={0.88} roughness={0.2} />
      </mesh>
      <mesh position={[-0.04, 1.62, 0]}>
        <boxGeometry args={[0.16, 0.42, 1.9]} />
        <meshPhysicalMaterial color="#101827" metalness={0.7} roughness={0.25} clearcoat={0.35} />
      </mesh>
      <mesh position={[-0.135, 1.62, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[1.55, 0.22]} />
        <meshStandardMaterial
          ref={signMaterial}
          color={CONGESTION_COLOR}
          emissive={CONGESTION_COLOR}
          emissiveIntensity={0.8}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

function TrafficVehicles({ progressRef }: { progressRef: ProgressRef }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null)
  const lightRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const vehicleGeometry = useMemo(() => buildVehicleGeometry(), [])
  const cars = useRef<CarState[]>(
    Array.from({ length: TOTAL_CARS }, (_, index) => ({
      lane: index % LANES,
      offset: ((Math.floor(index / LANES) / CARS_PER_LANE) * ROAD_LENGTH - ROAD_LENGTH / 2) + deterministic(index, 3) * 0.18,
      speed: 0.88 + deterministic(index, 4) * 0.24,
      connected: index % 19 === 0,
    })),
  )

  useEffect(() => () => vehicleGeometry.dispose(), [vehicleGeometry])

  useFrame((_, delta) => {
    const body = bodyRef.current
    const lights = lightRef.current
    if (!body || !lights) return
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const jamBuild = smoothstep(range01(p, 0.1, 0.42))
    const recovery = smoothstep(range01(p, 0.55, 0.92))
    const baseSpeed = THREE.MathUtils.lerp(1.2, 3.8, recovery)

    cars.current.forEach((car, index) => {
      const distance = Math.abs(car.offset)
      const bottleneck = 1 - Math.exp(-distance * distance * 0.7)
      const jamFactor = THREE.MathUtils.lerp(1, 0.22 + bottleneck * 0.45, jamBuild * (1 - recovery))
      car.offset += baseSpeed * car.speed * jamFactor * delta
      if (car.offset > ROAD_LENGTH / 2) car.offset -= ROAD_LENGTH
      const laneZ = (car.lane - 1) * 1.5

      dummy.position.set(car.offset, 0.08, laneZ)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(0.82)
      dummy.updateMatrix()
      body.setMatrixAt(index, dummy.matrix)
      dummy.position.set(car.offset - 0.31, 0.18, laneZ)
      if (car.connected && p > 0.5) {
        dummy.scale.set(0.045, 0.045, 0.14)
      } else {
        dummy.scale.setScalar(0.001)
      }
      dummy.updateMatrix()
      lights.setMatrixAt(index, dummy.matrix)
    })
    body.instanceMatrix.needsUpdate = true
    lights.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh
        ref={bodyRef}
        args={[vehicleGeometry, undefined, TOTAL_CARS]}
        castShadow
      >
        <meshStandardMaterial
          color="#94a3b8"
          emissive="#1e293b"
          emissiveIntensity={0.72}
          metalness={0.48}
          roughness={0.3}
        />
      </instancedMesh>
      <instancedMesh ref={lightRef} args={[undefined, undefined, TOTAL_CARS]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial color={GUIDANCE_COLOR} toneMapped={false} />
      </instancedMesh>
    </>
  )
}

function FlowTracers({ progressRef }: { progressRef: ProgressRef }) {
  const groups = useRef<THREE.Group[]>([])
  const materials = useRef<THREE.LineBasicMaterial[]>([])
  const paths = useMemo(
    () =>
      [-1.5, 0, 1.5].flatMap((z, lane) =>
        [-0.35, 0.35].map((offset, sub) => {
          const points: THREE.Vector3[] = []
          for (let index = 0; index <= 40; index++) {
            const x = -5.7 + (index / 40) * 11.4
            const compression = Math.exp(-x * x * 0.55)
            points.push(new THREE.Vector3(x, 0.09, z + offset * 0.22 + compression * (lane - 1) * 0.08))
          }
          return { points, lane, sub }
        }),
      ),
    [],
  )
  useFrame((state) => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const field = smoothstep(range01(p, 0.28, 0.55))
    const recovery = smoothstep(range01(p, 0.55, 0.9))
    groups.current.forEach((group, index) => {
      if (!group) return
      group.visible = field > 0.02
      group.position.x = ((state.clock.elapsedTime * (0.08 + recovery * 0.14) + index * 0.08) % 0.16) - 0.08
    })
    materials.current.forEach((material) => {
      material.opacity = field * (0.14 + recovery * 0.2)
      material.color.set(recovery > 0.55 ? GUIDANCE_COLOR : CFD_COLOR)
    })
  })
  return (
    <>
      {paths.map((path, index) => (
        <group key={index} ref={(group) => { if (group) groups.current[index] = group }} visible={false}>
          <Line
            points={path.points}
            color={CFD_COLOR}
            transparent
            opacity={0}
            lineWidth={1}
            dashed
            dashSize={0.1}
            gapSize={0.06}
            onUpdate={(line: THREE.Line) => {
              materials.current[index] = line.material as THREE.LineBasicMaterial
            }}
          />
        </group>
      ))}
    </>
  )
}

function GuidancePulses({ progressRef }: { progressRef: ProgressRef }) {
  const pulses = useRef<THREE.Mesh[]>([])
  useFrame(() => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const active = smoothstep(range01(p, 0.52, 0.78))
    const settle = smoothstep(range01(p, 0.86, 1))
    pulses.current.forEach((pulse, index) => {
      const cycle = (active * 2.5 - index * 0.32) % 1
      pulse.visible = active > 0.02 && settle < 0.98 && cycle > 0
      pulse.position.x = THREE.MathUtils.lerp(-2.5, 4.8, cycle)
      pulse.scale.setScalar(0.8 + cycle * 0.55)
      ;(pulse.material as THREE.MeshBasicMaterial).opacity = Math.sin(cycle * Math.PI) * 0.18
    })
  })
  return (
    <>
      {Array.from({ length: 3 }, (_, index) => (
        <mesh
          key={index}
          ref={(mesh) => { if (mesh) pulses.current[index] = mesh }}
          rotation={[0, Math.PI / 2, 0]}
          visible={false}
        >
          <torusGeometry args={[2.05, 0.025, 8, 48]} />
          <meshBasicMaterial
            color={GUIDANCE_COLOR}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  )
}

function TrafficScene({ progressRef }: { progressRef: ProgressRef }) {
  return (
    <>
      <color attach="background" args={['#040711']} />
      <fog attach="fog" args={['#040711', 9, 16]} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[4, 7, 5]} intensity={1.55} color="#f8fafc" castShadow />
      <directionalLight position={[-4, 3, -2]} intensity={0.62} color={CFD_COLOR} />
      <pointLight position={[0, 2, 2]} intensity={0.5} color={GUIDANCE_COLOR} distance={5} />
      <CameraRig progressRef={progressRef} />
      <CorridorStage />
      <RoadField progressRef={progressRef} />
      <LaneInfrastructure />
      <Gantry progressRef={progressRef} />
      <TrafficVehicles progressRef={progressRef} />
      <FlowTracers progressRef={progressRef} />
      <GuidancePulses progressRef={progressRef} />
    </>
  )
}

function getTelemetry(progress: number) {
  const p = THREE.MathUtils.clamp(progress, 0, 1)
  let phase = 'Baseline flow'
  let detail = 'Corridor nominal'
  let mode = 'MONITOR'
  if (p >= 0.86) {
    phase = 'Optimal flow'
    detail = 'Throughput stabilized'
    mode = 'OPTIMAL'
  } else if (p >= 0.72) {
    phase = 'Wave dissipation'
    detail = 'Jam length contracting'
    mode = 'RECOVER'
  } else if (p >= 0.55) {
    phase = 'Guidance active'
    detail = '5% connected cohort'
    mode = 'CONTROL'
  } else if (p >= 0.42) {
    phase = 'CFD diagnosis'
    detail = 'Density field solved'
    mode = 'SOLVE'
  } else if (p >= 0.28) {
    phase = 'Shockwave'
    detail = 'Queue propagating upstream'
    mode = 'CONGESTED'
  } else if (p >= 0.1) {
    phase = 'Bottleneck forming'
    detail = 'Merge demand rising'
    mode = 'DETECT'
  }
  return {
    phase,
    detail,
    mode,
    speed: `${THREE.MathUtils.lerp(42, 47.2, smoothstep(range01(p, 0.55, 0.96))).toFixed(1)} km/h`,
    density: p < 0.55 ? 'Congested' : p < 0.86 ? 'Recovering' : 'Optimal',
    reduction: `${Math.round(42 * smoothstep(range01(p, 0.55, 0.96)))}%`,
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
        className={`${className} research-viewer--flowstate`}
        progressPercent={Math.round(liveProgress * 100)}
        telemetry={
          <ViewerTelemetry
            label="Traffic digital twin"
            rows={[
              { key: 'Phase', value: telemetry.phase },
              { key: 'Avg speed', value: telemetry.speed },
              { key: 'Density', value: telemetry.density },
              { key: 'Jam ↓', value: telemetry.reduction },
              { key: 'Mode', value: telemetry.mode },
            ]}
          />
        }
        legend={
          <div className="research-viewer__legend">
            <span className="research-viewer__legend-item research-viewer__legend-item--slow">Congestion</span>
            <span className="research-viewer__legend-item research-viewer__legend-item--fast">Free flow</span>
            <span className="research-viewer__legend-item research-viewer__legend-item--guidance">Guidance</span>
            <span className="research-viewer__legend-item research-viewer__legend-item--flow">CFD field</span>
          </div>
        }
      >
        <Canvas
          camera={{ position: [-4.2, 5.8, 5.4], fov: 38, near: 0.1, far: 35 }}
          dpr={[1, 1.5]}
          shadows
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
          frameloop={isVisible && active ? 'always' : 'demand'}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <TrafficScene progressRef={progressRef} />
          </Suspense>
        </Canvas>
        <div className="viewer-phase" aria-hidden="true">
          <span className="viewer-phase__index">{String(Math.min(6, Math.floor(liveProgress * 7)) + 1).padStart(2, '0')}</span>
          <span className="viewer-phase__copy"><strong>{telemetry.phase}</strong><small>{telemetry.detail}</small></span>
        </div>
      </ResearchViewerFrame>
    </div>
  )
}
