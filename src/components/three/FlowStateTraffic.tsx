import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { useMotionValue, useMotionValueEvent, useSpring, type MotionValue } from 'motion/react'
import * as THREE from 'three'
import { useIntersectionPause } from '../../hooks/useIntersectionPause'
import { useMotionProgressRef } from '../../hooks/useMotionProgressRef'
import { useReducedMotion } from '../../hooks/useReducedMotion'
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

// Hoisted so no frame has to parse a colour string or allocate a THREE.Color.
const COLOR_CONGESTION = new THREE.Color(CONGESTION_COLOR)
const COLOR_FREE_FLOW = new THREE.Color(FREE_FLOW_COLOR)
const COLOR_GUIDANCE = new THREE.Color(GUIDANCE_COLOR)
const COLOR_CFD = new THREE.Color(CFD_COLOR)

// This canvas parks on frameloop "demand" while the section is off screen, so
// the first delta after it wakes can be seconds long. Everything below steps on
// a clamped delta so exponential smoothing converges instead of lurching.
const MAX_STEP = 0.05
// Approach rate for the shared scroll follower: fast enough to stay glued to
// the scrub, slow enough to swallow wheel and trackpad jitter.
const PROGRESS_LAMBDA = 11

// Car following. Mean spacing on this ring is ROAD_LENGTH / CARS_PER_LANE
// (0.6), so COMFORT_GAP sits below it: free flow is left alone and only a real
// compression wave makes a driver lift off. CRAWL_GAP is where they stop. This
// also puts a floor under how far the queue can compress, which the old
// position-driven speed field had no protection against at all.
const CRAWL_GAP = 0.34
const COMFORT_GAP = 0.5
// Drivers brake harder than they accelerate, which is what makes stop-and-go
// read as stop-and-go rather than as a smooth speed dial.
const ACCEL_LAMBDA = 1.7
const BRAKE_LAMBDA = 5.4

type ProgressRef = React.RefObject<number | null>

interface CarState {
  lane: number
  offset: number
  speed: number
  velocity: number
  pitch: number
  connected: boolean
  jitter: number
}

function range01(value: number, start: number, end: number) {
  return THREE.MathUtils.clamp((value - start) / (end - start), 0, 1)
}

/** Clamp a frame delta so a woken canvas cannot take one enormous step. */
function frameStep(delta: number) {
  if (!(delta > 0)) return 0
  return delta > MAX_STEP ? MAX_STEP : delta
}

/** Fractional part, correct for negative input, so modulo cycles never flip sign. */
function wrap01(value: number) {
  return value - Math.floor(value)
}

function wrapTo(value: number, span: number) {
  return value - Math.floor(value / span) * span
}

function deterministic(index: number, salt: number) {
  return ((Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453) % 1 + 1) % 1
}

function createCars(): CarState[] {
  return Array.from({ length: TOTAL_CARS }, (_, index) => {
    const speed = 0.88 + deterministic(index, 4) * 0.24
    return {
      lane: index % LANES,
      offset:
        ((Math.floor(index / LANES) / CARS_PER_LANE) * ROAD_LENGTH - ROAD_LENGTH / 2) +
        deterministic(index, 3) * 0.18,
      speed,
      velocity: speed * 1.2,
      pitch: 0,
      connected: index % 19 === 0,
      jitter: deterministic(index, 7),
    }
  })
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

/**
 * One place that turns the raw scroll value into a damped one. Every other
 * useFrame in this scene reads the damped ref, so scroll jitter is filtered
 * once and the whole scene stays in phase with itself.
 */
function ProgressSmoother({
  rawRef,
  smoothRef,
}: {
  rawRef: ProgressRef
  smoothRef: React.RefObject<number>
}) {
  const readyRef = useRef(false)
  // Negative priority only affects ordering: R3F keeps auto-rendering unless a
  // subscriber asks for a priority above zero. This guarantees the smoothed
  // value is fresh before any consumer in this scene reads it.
  useFrame((_, delta) => {
    const target = THREE.MathUtils.clamp(rawRef.current ?? 0, 0, 1)
    if (!readyRef.current) {
      readyRef.current = true
      smoothRef.current = target
      return
    }
    smoothRef.current = THREE.MathUtils.damp(
      smoothRef.current,
      target,
      PROGRESS_LAMBDA,
      frameStep(delta),
    )
  }, -1)
  return null
}

function CameraRig({ progressRef }: { progressRef: ProgressRef }) {
  const { camera } = useThree()
  const positionRef = useRef(new THREE.Vector3())
  const targetRef = useRef(new THREE.Vector3())
  const lookRef = useRef(new THREE.Vector3(-0.8, 0, 0.1))
  const readyRef = useRef(false)

  useFrame((_, delta) => {
    const dt = frameStep(delta)
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

    if (!readyRef.current) {
      camera.position.copy(position)
      lookRef.current.copy(target)
      readyRef.current = true
    } else {
      // Frame-rate independent follow. The old fixed 0.1 alpha meant the
      // camera moved at a different speed on a 120 Hz display.
      camera.position.lerp(position, 1 - Math.exp(-6.5 * dt))
      // The look-at point is damped too, otherwise every scroll tick lands
      // straight on the camera's rotation.
      lookRef.current.lerp(target, 1 - Math.exp(-5 * dt))
    }
    camera.lookAt(lookRef.current)
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
  // The sign used to flip red to green in a single frame at guidance > 0.5.
  // This carries its own damped copy so the changeover reads as the panel
  // relighting rather than as a hard cut.
  const litRef = useRef(0)
  useFrame((_, delta) => {
    const material = signMaterial.current
    if (!material) return
    const dt = frameStep(delta)
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const guidance = smoothstep(range01(p, 0.52, 0.75))
    litRef.current = THREE.MathUtils.damp(litRef.current, guidance, 4.5, dt)
    const lit = litRef.current
    material.color.lerpColors(COLOR_CONGESTION, COLOR_FREE_FLOW, lit)
    material.emissive.lerpColors(COLOR_CONGESTION, COLOR_FREE_FLOW, lit)
    // A short bloom as the message changes, so the sign has a beat of its own.
    const changeover = Math.exp(-Math.pow((lit - 0.5) * 4.6, 2))
    material.emissiveIntensity = 0.8 + lit * 2 + changeover * 1.15
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

function TrafficVehicles({
  progressRef,
  reduced,
}: {
  progressRef: ProgressRef
  reduced: boolean
}) {
  const bodyRef = useRef<THREE.InstancedMesh>(null)
  const lightRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const vehicleGeometry = useMemo(() => buildVehicleGeometry(), [])
  const cars = useRef<CarState[]>(createCars())

  useEffect(() => () => vehicleGeometry.dispose(), [vehicleGeometry])

  useFrame((state, delta) => {
    const body = bodyRef.current
    const lights = lightRef.current
    if (!body || !lights) return
    const dt = frameStep(delta)
    const time = state.clock.elapsedTime
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const jamBuild = smoothstep(range01(p, 0.1, 0.42))
    const recovery = smoothstep(range01(p, 0.55, 0.92))
    const jam = jamBuild * (1 - recovery)
    const baseSpeed = THREE.MathUtils.lerp(1.2, 3.8, recovery)
    // Beacons used to blink on the instant progress crossed 0.5.
    const beacon = smoothstep(range01(p, 0.48, 0.6))
    // Stop-and-go bands travel back up the queue. Purely additional energy, so
    // it is switched off entirely under prefers-reduced-motion.
    const waveAmount = reduced ? 0 : jam * 0.55

    const list = cars.current
    for (let index = 0; index < list.length; index += 1) {
      const car = list[index]
      if (!car) continue

      // Cars never overtake, so the cyclic order inside a lane is fixed and the
      // car ahead is always LANES slots further along the flat array.
      const leader = list[(index + LANES) % TOTAL_CARS]
      let gap = ROAD_LENGTH / CARS_PER_LANE
      if (leader && leader !== car) {
        gap = leader.offset - car.offset
        if (gap <= 0) gap += ROAD_LENGTH
      }

      // Capacity throat sits on the merge taper, with a milder corridor-wide
      // drop around it. The queue behind it is not scripted; it emerges
      // because each driver reacts to the one ahead.
      const throat = Math.exp(-Math.pow((car.offset + 0.25) * 0.92, 2))
      const capacity = 1 - jam * (0.26 + 0.52 * throat)
      const queue = smoothstep(range01(-car.offset, 0.1, 3.2))
      const band = 0.5 + 0.5 * Math.sin(car.offset * 2.35 + time * 1.9 + car.lane * 0.4)
      const desired = baseSpeed * car.speed * capacity * (1 - waveAmount * queue * band)

      // Soft following term: no effect at the natural spacing, near a full stop
      // once the gap closes to CRAWL_GAP.
      const follow = smoothstep(range01(gap, CRAWL_GAP, COMFORT_GAP))
      const target = Math.max(0, desired * (0.05 + 0.95 * follow))

      // Asymmetric approach: ease onto the throttle, come off it quickly.
      const lambda = target < car.velocity ? BRAKE_LAMBDA : ACCEL_LAMBDA
      const nextVelocity = THREE.MathUtils.damp(car.velocity, target, lambda, dt)
      const accel = dt > 0 ? (nextVelocity - car.velocity) / dt : 0
      car.velocity = nextVelocity
      car.offset += car.velocity * dt
      if (car.offset > ROAD_LENGTH / 2) car.offset -= ROAD_LENGTH

      // Weight transfer: the nose dips under braking and lifts on the throttle.
      const pitchTarget = reduced ? 0 : THREE.MathUtils.clamp(accel * 0.016, -0.055, 0.055)
      car.pitch = THREE.MathUtils.damp(car.pitch, pitchTarget, 9, dt)

      const laneZ = (car.lane - 1) * 1.5
      dummy.position.set(car.offset, 0.08, laneZ)
      dummy.rotation.set(0, 0, car.pitch)
      dummy.scale.setScalar(0.82)
      dummy.updateMatrix()
      body.setMatrixAt(index, dummy.matrix)

      dummy.position.set(car.offset - 0.31, 0.18, laneZ)
      dummy.rotation.set(0, 0, 0)
      if (car.connected && beacon > 0.01) {
        const blink = reduced ? 1 : 0.74 + 0.26 * Math.sin(time * 5.4 + car.jitter * Math.PI * 2)
        const amount = Math.max(0.02, beacon * blink)
        dummy.scale.set(0.045 * amount, 0.045 * amount, 0.14 * amount)
      } else {
        dummy.scale.setScalar(0.001)
      }
      dummy.updateMatrix()
      lights.setMatrixAt(index, dummy.matrix)
    }
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
  // Accumulated drift instead of elapsedTime * rate. Multiplying a large clock
  // by a changing rate teleports the dashes whenever the rate moves.
  const driftRef = useRef(0)
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
  useFrame((_, delta) => {
    const dt = frameStep(delta)
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const field = smoothstep(range01(p, 0.28, 0.55))
    const recovery = smoothstep(range01(p, 0.55, 0.9))
    // One dash period, so the wrap is invisible.
    driftRef.current = wrapTo(driftRef.current + dt * (0.08 + recovery * 0.14), 0.16)
    const total = Math.max(1, paths.length - 1)
    const tint = smoothstep(range01(recovery, 0.3, 0.8))

    groups.current.forEach((group, index) => {
      if (!group) return
      group.visible = field > 0.02
      group.position.x = wrapTo(driftRef.current + index * 0.08, 0.16) - 0.08
    })
    materials.current.forEach((material, index) => {
      // Callback-ref array: an entry can still be undefined on the first frame
      // after mount, and a throw inside useFrame kills this canvas's loop.
      if (!material) return
      // Ribbons arrive in order rather than as one block.
      const lead = (index / total) * 0.4
      const gate = smoothstep(range01(field, lead, lead + 0.6))
      material.opacity = gate * field * (0.14 + recovery * 0.2)
      material.color.lerpColors(COLOR_CFD, COLOR_GUIDANCE, tint)
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

function GuidancePulses({
  progressRef,
  reduced,
}: {
  progressRef: ProgressRef
  reduced: boolean
}) {
  const pulses = useRef<THREE.Mesh[]>([])
  // Accumulated phase rather than progress * 2.5, so the wavefront keeps a
  // steady speed instead of stuttering with the scroll.
  const phaseRef = useRef(0)
  useFrame((_, delta) => {
    const dt = frameStep(delta)
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const active = smoothstep(range01(p, 0.52, 0.78))
    const settle = smoothstep(range01(p, 0.86, 1))
    const strength = active * (1 - settle)

    if (reduced) {
      // No self-running loop: the phase stays tied to the scrub.
      phaseRef.current = wrap01(active * 2.5)
    } else {
      phaseRef.current = wrap01(phaseRef.current + dt * (0.3 + active * 0.32))
    }

    for (let index = 0; index < pulses.current.length; index += 1) {
      const pulse = pulses.current[index]
      if (!pulse) continue
      const cycle = wrap01(phaseRef.current - index * 0.32)
      // Ramp in at the start of the run and out at the end, so the modulo wrap
      // never lands on a visible ring.
      const fade =
        smoothstep(range01(cycle, 0, 0.18)) * (1 - smoothstep(range01(cycle, 0.7, 1)))
      const amount = fade * strength
      const material = pulse.material as THREE.MeshBasicMaterial
      pulse.visible = amount > 0.005
      if (!pulse.visible) continue
      pulse.position.x = THREE.MathUtils.lerp(-2.5, 4.8, cycle)
      pulse.scale.setScalar(0.8 + cycle * 0.55)
      material.opacity = amount * 0.24
    }
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

function TrafficScene({
  progressRef,
  reduced,
}: {
  progressRef: ProgressRef
  reduced: boolean
}) {
  // Seeded from the raw ref by ProgressSmoother on its first frame.
  const smoothProgress = useRef(0)
  return (
    <>
      <color attach="background" args={['#040711']} />
      <fog attach="fog" args={['#040711', 9, 16]} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[4, 7, 5]} intensity={1.55} color="#f8fafc" castShadow />
      <directionalLight position={[-4, 3, -2]} intensity={0.62} color={CFD_COLOR} />
      <pointLight position={[0, 2, 2]} intensity={0.5} color={GUIDANCE_COLOR} distance={5} />
      <ProgressSmoother rawRef={progressRef} smoothRef={smoothProgress} />
      <CameraRig progressRef={smoothProgress} />
      <CorridorStage />
      <RoadField progressRef={smoothProgress} />
      <LaneInfrastructure />
      <Gantry progressRef={smoothProgress} />
      <TrafficVehicles progressRef={smoothProgress} reduced={reduced} />
      <FlowTracers progressRef={smoothProgress} />
      <GuidancePulses progressRef={smoothProgress} reduced={reduced} />
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

// Overdamped on purpose: the readouts settle without ever overshooting past a
// phase boundary and flicking the label back and forth.
const TELEMETRY_SPRING = {
  stiffness: 110,
  damping: 30,
  mass: 0.55,
  restDelta: 0.0004,
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
  const reduced = useReducedMotion()
  const progressRef = useMotionProgressRef(progress, scrollProgress)
  const fallbackProgress = useMotionValue(scrollProgress)
  const source = progress ?? fallbackProgress
  // The 3D scene keeps reading the raw value; only the printed numbers are
  // damped, so the readouts stop flickering without the scene going soft.
  const settledSource = useSpring(source, TELEMETRY_SPRING)
  const liveProgress = useThrottledMotionValue(reduced ? source : settledSource, 100)

  useEffect(() => {
    if (!progress) fallbackProgress.set(scrollProgress)
  }, [progress, scrollProgress, fallbackProgress])
  useEffect(() => {
    progressRef.current = progress?.get() ?? scrollProgress
  }, [progress, scrollProgress, progressRef])
  useMotionValueEvent(source, 'change', (value) => {
    progressRef.current = value
  })

  const shownProgress = THREE.MathUtils.clamp(liveProgress, 0, 1)
  const telemetry = getTelemetry(shownProgress)

  return (
    <div ref={containerRef}>
      <ResearchViewerFrame
        className={`${className} research-viewer--flowstate`}
        progressPercent={Math.round(shownProgress * 100)}
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
          gl={{ alpha: true, antialias: false, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
          frameloop={isVisible && active ? 'always' : 'demand'}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <TrafficScene progressRef={progressRef} reduced={reduced} />
          </Suspense>
        </Canvas>
        <div className="viewer-phase" aria-hidden="true">
          <span className="viewer-phase__index">{String(Math.min(6, Math.floor(shownProgress * 7)) + 1).padStart(2, '0')}</span>
          <span className="viewer-phase__copy"><strong>{telemetry.phase}</strong><small>{telemetry.detail}</small></span>
        </div>
      </ResearchViewerFrame>
    </div>
  )
}
