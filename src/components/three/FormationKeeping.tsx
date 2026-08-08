import { Suspense, memo, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
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
 * Estimation-in-the-loop J2 formation-keeping. Four beats: two satellites
 * drift apart over a dark Earth; the controller chases a GHOST estimate inside
 * an uncertainty ellipsoid; the sensor-fuel trade line slopes the wrong way,
 * glitches, and snaps back; the formation settles. Red is reserved for the
 * wrong-way beat.
 */

const TRUTH_COLOR = '#f8fafc'
const ESTIMATE_COLOR = '#4de3ff'
const WRONG_COLOR = '#ff5a3c'
const EARTH_COLOR = '#0b1d33'
const RIBBON_COLOR = '#4de3ff'

const PROGRESS_FOLLOW_RATE = 11
const CAMERA_FOLLOW_RATE = 6
const SNAP_RATE = 1e4
const READOUT_RATE = 8

const ORBIT_RADIUS = 1.72
const STAR_COUNT = 240
const TRAIL_COUNT = 26
const CHART_POINTS = 24

/** Chart parked off to the side; the camera travels to it for beat 3. */
const CHART_POS = new THREE.Vector3(3.1, 0.18, 0.9)

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

/** Orbit angle plus the beat windows every component agrees on. */
function beats(p: number) {
  return {
    ghost: smoothstep(range01(p, 0.26, 0.42)) * (1 - smoothstep(range01(p, 0.5, 0.6))),
    chart: smoothstep(range01(p, 0.52, 0.62)) * (1 - smoothstep(range01(p, 0.82, 0.9))),
    // The glitch is a window, not a ramp: it builds and then resolves.
    glitch:
      smoothstep(range01(p, 0.6, 0.66)) * (1 - smoothstep(range01(p, 0.7, 0.76))),
    fix: smoothstep(range01(p, 0.7, 0.8)),
    resolve: smoothstep(range01(p, 0.84, 0.96)),
  }
}

function CameraRig({
  progressRef,
  chiefPosRef,
  reduced,
}: {
  progressRef: ProgressRef
  chiefPosRef: React.RefObject<THREE.Vector3>
  reduced: boolean
}) {
  const { camera } = useThree()
  const positionRef = useRef(new THREE.Vector3())
  const targetRef = useRef(new THREE.Vector3())
  const lookRef = useRef(new THREE.Vector3())
  const clockRef = useRef(0)
  const primedRef = useRef(false)

  useFrame((_, frameDelta) => {
    const dt = Math.min(frameDelta, MAX_DELTA)
    clockRef.current += dt
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const b = beats(p)
    const push = smoothstep(range01(p, 0.24, 0.4)) * (1 - smoothstep(range01(p, 0.5, 0.6)))
    const chief = chiefPosRef.current

    const t = clockRef.current
    const breathX = reduced ? 0 : Math.sin(t * 0.16) * 0.03
    const breathY = reduced ? 0 : Math.sin(t * 0.12 + 0.9) * 0.02

    const position = positionRef.current
    const target = targetRef.current

    // Three poses blended: wide orbit view, satellite close-up, chart wall.
    position.set(0.4 + breathX, 1.1 + breathY, 5.2)
    target.set(0, 0, 0)
    if (push > 0) {
      position.lerp(
        new THREE.Vector3(chief.x + 0.55, chief.y + 0.35, chief.z + 1.35),
        push,
      )
      target.lerp(chief, push)
    }
    if (b.chart > 0) {
      position.lerp(new THREE.Vector3(CHART_POS.x + 0.1, CHART_POS.y + 0.25, 4.15), b.chart)
      target.lerp(new THREE.Vector3(CHART_POS.x, CHART_POS.y, CHART_POS.z), b.chart)
    }

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

function Starfield() {
  const geometry = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3)
    for (let i = 0; i < STAR_COUNT; i++) {
      const r = 9 + hash01(i * 3 + 1) * 5
      const theta = hash01(i * 3 + 2) * Math.PI * 2
      const phi = Math.acos(2 * hash01(i * 3 + 3) - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi)
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geo
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color="#cbd5e1"
        size={0.025}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </points>
  )
}

function Earth() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.85, 40, 40]} />
        <meshStandardMaterial
          color={EARTH_COLOR}
          emissive="#123a5e"
          emissiveIntensity={0.35}
          roughness={0.85}
          metalness={0.1}
        />
      </mesh>
      {/* Atmosphere: back-face shell, additive, so the limb glows. */}
      <mesh scale={1.07}>
        <sphereGeometry args={[0.85, 40, 40]} />
        <meshBasicMaterial
          color="#2563eb"
          transparent
          opacity={0.16}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

function Satellite({ color, scale = 1 }: { color: string; scale?: number }) {
  return (
    <group scale={scale}>
      <mesh>
        <boxGeometry args={[0.07, 0.05, 0.05]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0.085, 0, 0]}>
        <boxGeometry args={[0.09, 0.002, 0.05]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[-0.085, 0, 0]}>
        <boxGeometry args={[0.09, 0.002, 0.05]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>
    </group>
  )
}

/**
 * The whole orbital story: chief + deputy, comet-ribbon trails, the ghost
 * estimate with its ellipsoid, and the thruster puffs that chase the ghost.
 * Publishes the chief's world position for the camera rig.
 */
function Formation({
  progressRef,
  chiefPosRef,
}: {
  progressRef: ProgressRef
  chiefPosRef: React.RefObject<THREE.Vector3>
}) {
  const planeRef = useRef<THREE.Group>(null)
  const chiefRef = useRef<THREE.Group>(null)
  const deputyRef = useRef<THREE.Group>(null)
  const ghostRef = useRef<THREE.Group>(null)
  const ellipsoidRef = useRef<THREE.Mesh>(null)
  const puffRef = useRef<THREE.Mesh>(null)
  const chiefTrailRef = useRef<THREE.InstancedMesh>(null)
  const deputyTrailRef = useRef<THREE.InstancedMesh>(null)
  const clockRef = useRef(0)
  const angleRef = useRef(0.6)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const scratch = useMemo(() => new THREE.Vector3(), [])

  const orbitPoints = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2
      pts.push([Math.cos(a) * ORBIT_RADIUS, 0, Math.sin(a) * ORBIT_RADIUS])
    }
    return pts
  }, [])

  useFrame((_, frameDelta) => {
    const dt = Math.min(frameDelta, MAX_DELTA)
    clockRef.current += dt
    const time = clockRef.current
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const b = beats(p)
    const push = smoothstep(range01(p, 0.24, 0.4)) * (1 - smoothstep(range01(p, 0.5, 0.6)))

    // The orbit nearly parks while the camera sits on the satellite's shoulder
    // and while the chart beat plays, so neither framing has to chase it.
    const rate = 0.16 * (1 - 0.94 * Math.max(push, b.chart))
    angleRef.current += rate * dt
    const theta = angleRef.current

    const chiefLocal = scratch.set(
      Math.cos(theta) * ORBIT_RADIUS,
      0,
      Math.sin(theta) * ORBIT_RADIUS,
    )
    if (chiefRef.current) chiefRef.current.position.copy(chiefLocal)

    // J2 differential drift: the deputy's offset breathes and grows until the
    // resolve beat pulls the formation tight.
    const drift = (1 - b.resolve) * (0.09 + 0.05 * Math.sin(time * 0.7))
    const tight = THREE.MathUtils.lerp(0.16 + drift, 0.09, b.resolve)
    const dTheta = theta - tight
    if (deputyRef.current) {
      deputyRef.current.position.set(
        Math.cos(dTheta) * ORBIT_RADIUS,
        (1 - b.resolve) * 0.06 * Math.sin(time * 0.9),
        Math.sin(dTheta) * ORBIT_RADIUS,
      )
    }

    // Ghost estimate: offset from the chief, shimmering. It exists only while
    // the filter beat plays; the ellipsoid breathes around it.
    if (ghostRef.current) {
      const err = 0.16 * b.ghost
      ghostRef.current.visible = b.ghost > 0.02
      ghostRef.current.position.set(
        chiefLocal.x + err * Math.sin(time * 1.3),
        err * 0.9 * Math.cos(time * 0.8),
        chiefLocal.z + err * Math.cos(time * 1.1),
      )
      ghostRef.current.traverse((node) => {
        const mesh = node as THREE.Mesh
        const material = mesh.material as THREE.MeshBasicMaterial | undefined
        if (material && 'opacity' in material) material.opacity = 0.5 * b.ghost
      })
    }
    if (ellipsoidRef.current && ghostRef.current) {
      const breathe = 1 + Math.sin(time * 2.2) * 0.12
      ellipsoidRef.current.visible = b.ghost > 0.02
      ellipsoidRef.current.position.copy(ghostRef.current.position)
      ellipsoidRef.current.scale.set(0.34 * breathe, 0.22 * breathe, 0.16 * breathe)
      ;(ellipsoidRef.current.material as THREE.MeshBasicMaterial).opacity = 0.14 * b.ghost
    }

    // Thruster puff: fires in bursts, aimed at the ghost - the whole finding
    // in one image. The controller chases the estimate, not the truth.
    if (puffRef.current && ghostRef.current && chiefRef.current) {
      const burst = Math.max(0, Math.sin(time * 4.2)) ** 6
      puffRef.current.visible = b.ghost > 0.05 && burst > 0.01
      puffRef.current.position.copy(chiefRef.current.position)
      puffRef.current.lookAt(
        ghostRef.current.getWorldPosition(new THREE.Vector3()),
      )
      // Cones point +Y after lookAt correction below; orient along the look
      // axis by rotating the geometry's default +Y onto +Z.
      puffRef.current.rotateX(Math.PI / 2)
      puffRef.current.scale.setScalar(0.6 + burst * 0.5)
      ;(puffRef.current.material as THREE.MeshBasicMaterial).opacity = 0.55 * burst * b.ghost
    }

    // Comet ribbons: instanced dots trailing each satellite along the orbit.
    const trails: [THREE.InstancedMesh | null, number][] = [
      [chiefTrailRef.current, theta],
      [deputyTrailRef.current, dTheta],
    ]
    for (const [mesh, head] of trails) {
      if (!mesh) continue
      for (let i = 0; i < TRAIL_COUNT; i++) {
        const back = head - (i + 1) * 0.045
        const fade = 1 - i / TRAIL_COUNT
        dummy.position.set(
          Math.cos(back) * ORBIT_RADIUS,
          0,
          Math.sin(back) * ORBIT_RADIUS,
        )
        dummy.scale.setScalar(0.02 * fade + 0.004)
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }

    if (planeRef.current && chiefRef.current) {
      chiefRef.current.getWorldPosition(chiefPosRef.current)
    }
  })

  return (
    <group ref={planeRef} rotation={[0.42, 0, -0.5]}>
      <Line points={orbitPoints} color={RIBBON_COLOR} transparent opacity={0.18} lineWidth={1} />
      <group ref={chiefRef}>
        <Satellite color={ESTIMATE_COLOR} />
      </group>
      <group ref={deputyRef}>
        <Satellite color={TRUTH_COLOR} scale={0.85} />
      </group>
      <group ref={ghostRef} visible={false}>
        <mesh>
          <boxGeometry args={[0.07, 0.05, 0.05]} />
          <meshBasicMaterial
            color={ESTIMATE_COLOR}
            wireframe
            transparent
            opacity={0}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      </group>
      <mesh ref={ellipsoidRef} visible={false}>
        <sphereGeometry args={[1, 20, 16]} />
        <meshBasicMaterial
          color={ESTIMATE_COLOR}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={puffRef} visible={false}>
        <coneGeometry args={[0.03, 0.09, 8]} />
        <meshBasicMaterial
          color="#e2e8f0"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <instancedMesh ref={chiefTrailRef} args={[undefined, undefined, TRAIL_COUNT]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial
          color={ESTIMATE_COLOR}
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh ref={deputyTrailRef} args={[undefined, undefined, TRAIL_COUNT]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial
          color={TRUTH_COLOR}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  )
}

/**
 * The trade chart: delta-V cost versus sensor accuracy. Slopes the wrong way
 * in red, glitches, then snaps to the physical slope in cyan while the
 * uncertainty band breathes open to honestly contain the truth.
 */
function TradeChart({ progressRef }: { progressRef: ProgressRef }) {
  const groupRef = useRef<THREE.Group>(null)
  const bandRef = useRef<THREE.Mesh>(null)
  const axesMat = useRef<THREE.LineBasicMaterial>(null)
  const clockRef = useRef(0)
  const colorScratch = useMemo(() => new THREE.Color(), [])
  const wrongColor = useMemo(() => new THREE.Color(WRONG_COLOR), [])
  const rightColor = useMemo(() => new THREE.Color(ESTIMATE_COLOR), [])
  const flashColor = useMemo(() => new THREE.Color('#ffffff'), [])

  const lineGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(CHART_POINTS * 3), 3),
    )
    return geo
  }, [])
  const bandGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(CHART_POINTS * 2 * 3), 3),
    )
    const index: number[] = []
    for (let i = 0; i < CHART_POINTS - 1; i++) {
      const a = i * 2
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    geo.setIndex(index)
    return geo
  }, [])
  const axesGeometry = useMemo(() => {
    const pts = [
      // x axis (sensor error grows to the right), y axis (delta-V cost).
      -0.9, -0.55, 0, 0.95, -0.55, 0,
      -0.9, -0.55, 0, -0.9, 0.6, 0,
      // Ticks.
      -0.45, -0.55, 0, -0.45, -0.51, 0,
      0.0, -0.55, 0, 0.0, -0.51, 0,
      0.45, -0.55, 0, 0.45, -0.51, 0,
    ]
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return geo
  }, [])

  // R3F maps a JSX <line> to the SVG element, so the trade line is built as a
  // THREE.Line directly and mounted through <primitive>. Its material attaches
  // via JSX so per-frame mutation goes through a ref, never the memoized line.
  const tradeLine = useMemo(() => new THREE.Line(lineGeometry), [lineGeometry])
  const lineMatRef = useRef<THREE.LineBasicMaterial>(null)

  useEffect(() => {
    return () => {
      lineGeometry.dispose()
      bandGeometry.dispose()
      axesGeometry.dispose()
    }
  }, [lineGeometry, bandGeometry, axesGeometry])

  useFrame((_, frameDelta) => {
    const group = groupRef.current
    if (!group) return
    clockRef.current += Math.min(frameDelta, MAX_DELTA)
    const time = clockRef.current
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1)
    const b = beats(p)

    group.visible = b.chart > 0.02
    if (!group.visible) return
    group.scale.setScalar(0.85 + 0.15 * b.chart)

    const positions = lineGeometry.getAttribute('position') as THREE.BufferAttribute
    const band = bandGeometry.getAttribute('position') as THREE.BufferAttribute
    // Overconfident filters report a sliver of a band; the fix widens it.
    const bandHalf = THREE.MathUtils.lerp(0.015, 0.13, b.fix)

    for (let i = 0; i < CHART_POINTS; i++) {
      const f = i / (CHART_POINTS - 1)
      const x = THREE.MathUtils.lerp(-0.82, 0.88, f)
      // Wrong: cost FALLS as sensors worsen. Right: cost rises.
      const wrongY = 0.38 - 0.7 * f
      const rightY = -0.38 + 0.75 * f
      let y = THREE.MathUtils.lerp(wrongY, rightY, b.fix)
      y += (hash01(i * 13 + Math.floor(time * 30)) - 0.5) * 0.14 * b.glitch
      positions.setXYZ(i, x, y, 0)
      band.setXYZ(i * 2, x, y + bandHalf, -0.002)
      band.setXYZ(i * 2 + 1, x, y - bandHalf, -0.002)
    }
    positions.needsUpdate = true
    band.needsUpdate = true

    colorScratch.copy(wrongColor).lerp(rightColor, b.fix)
    if (b.glitch > 0) {
      const flicker = hash01(Math.floor(time * 24)) < 0.4 ? b.glitch : 0
      colorScratch.lerp(flashColor, flicker * 0.8)
    }
    const lineMat = lineMatRef.current
    if (lineMat) {
      lineMat.color.copy(colorScratch)
      lineMat.opacity = 0.95 * b.chart
    }
    const bandMat = (bandRef.current?.material ?? null) as THREE.MeshBasicMaterial | null
    if (bandMat) {
      bandMat.color.copy(colorScratch)
      bandMat.opacity = 0.16 * b.chart
    }
    if (axesMat.current) axesMat.current.opacity = 0.5 * b.chart
  })

  return (
    <group ref={groupRef} position={CHART_POS} visible={false}>
      <lineSegments geometry={axesGeometry}>
        <lineBasicMaterial
          ref={axesMat}
          color="#94a3b8"
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </lineSegments>
      <primitive object={tradeLine}>
        <lineBasicMaterial
          ref={lineMatRef}
          attach="material"
          color={WRONG_COLOR}
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </primitive>
      <mesh ref={bandRef} geometry={bandGeometry}>
        <meshBasicMaterial
          color={WRONG_COLOR}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

const FormationScene = memo(function FormationScene({
  scrollTargetRef,
  sceneProgressRef,
  reduced,
}: {
  scrollTargetRef: ProgressRef
  sceneProgressRef: React.RefObject<number>
  reduced: boolean
}) {
  const chiefPosRef = useRef(new THREE.Vector3(ORBIT_RADIUS, 0, 0))

  return (
    <>
      <ProgressDriver targetRef={scrollTargetRef} sceneRef={sceneProgressRef} />
      <color attach="background" args={['#05070f']} />
      <fog attach="fog" args={['#05070f', 8, 15]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[4, 3, 5]} intensity={1.4} color="#e2e8f0" />
      <pointLight position={[-3, 1, 2]} intensity={0.5} color="#4de3ff" distance={8} />
      <CameraRig progressRef={sceneProgressRef} chiefPosRef={chiefPosRef} reduced={reduced} />
      <Starfield />
      <Earth />
      <Formation progressRef={sceneProgressRef} chiefPosRef={chiefPosRef} />
      <TradeChart progressRef={sceneProgressRef} />
    </>
  )
})

function getTelemetry(progress: number) {
  const p = THREE.MathUtils.clamp(progress, 0, 1)
  let phase = 'J2 drift'
  let phaseDetail = 'Two satellites, one perturbation'
  let index = 1
  if (p >= 0.84) {
    phase = 'Physics restored'
    phaseDetail = 'Fix the filter and the physics returns'
    index = 5
  } else if (p >= 0.7) {
    phase = 'The fix'
    phaseDetail = 'Retuned filter, honest covariance'
    index = 4
  } else if (p >= 0.52) {
    phase = 'The inversion'
    phaseDetail = 'Better sensors looked worse'
    index = 3
  } else if (p >= 0.24) {
    phase = 'The ghost'
    phaseDetail = 'The controller never sees the truth'
    index = 2
  }

  const simsT = smoothstep(range01(p, 0.5, 0.84))
  let trade = '—'
  if (p >= 0.76) trade = 'Restored'
  else if (p >= 0.56) trade = 'Inverted'
  return {
    phase,
    phaseDetail,
    index,
    sims: simsT > 0 ? Math.round(45860 * simsT).toLocaleString('en-US') : '—',
    trade,
    nav: 'DGPS · RF · optical',
    regime: p >= 0.84 ? 'Corrected' : 'J2 · secular',
  }
}

export interface FormationKeepingProps {
  scrollProgress?: number
  progress?: MotionValue<number>
  active?: boolean
  className?: string
}

export function FormationKeeping({
  scrollProgress = 0,
  progress,
  active = true,
  className = '',
}: FormationKeepingProps) {
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
        className={`${className} research-viewer--eilj2`}
        progressPercent={Math.round(shownProgress * 100)}
        telemetry={
          <ViewerTelemetry
            label="When the filter lies"
            rows={[
              { key: 'Phase', value: telemetry.phase },
              { key: 'Sims', value: telemetry.sims },
              { key: 'Nav', value: telemetry.nav },
              { key: 'Trade', value: telemetry.trade },
              { key: 'Drift', value: telemetry.regime },
            ]}
          />
        }
        legend={
          <div className="research-viewer__legend">
            <span className="research-viewer__legend-item research-viewer__legend-item--eil-truth">
              Truth state
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--eil-ghost">
              Filter estimate
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--eil-cov">
              Uncertainty
            </span>
            <span className="research-viewer__legend-item research-viewer__legend-item--eil-wrong">
              Inverted trade
            </span>
          </div>
        }
      >
        <Canvas
          camera={{ position: [0.4, 1.1, 5.2], fov: 38, near: 0.1, far: 40 }}
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
            <FormationScene
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
