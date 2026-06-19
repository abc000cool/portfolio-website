import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, Line } from '@react-three/drei'
import { useMotionValueEvent, useMotionValue, type MotionValue } from 'motion/react'
import * as THREE from 'three'
import { useIntersectionPause } from '../../hooks/useIntersectionPause'
import {
  CHORD_LENGTH,
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

const FLOW_LINES = 5

interface SceneProps {
  progressRef: React.RefObject<number | null>
  active: boolean
  profiles: AirfoilProfile[]
  onMorphChange?: (morph: MorphState) => void
}

function CameraRig({ progressRef }: { progressRef: React.RefObject<number | null> }) {
  const { camera } = useThree()
  const lookAt = useMemo(() => new THREE.Vector3(0, 0, 0), [])

  useFrame(() => {
    const p = smoothstep(progressRef.current ?? 0)
    const angle = THREE.MathUtils.lerp(-0.28, 0.38, p)
    const radius = THREE.MathUtils.lerp(4.6, 3.9, p)
    const elevation = THREE.MathUtils.lerp(0.05, 0.42, p)

    camera.position.set(
      Math.sin(angle) * radius,
      elevation,
      Math.cos(angle) * radius,
    )
    camera.lookAt(lookAt)
  })

  return null
}

function FlowLines({ morphRef }: { morphRef: React.RefObject<MorphState | null> }) {
  const lines = useMemo(() => {
    const result: [THREE.Vector3, THREE.Vector3][] = []
    const yMin = -0.55
    const yMax = 0.55
    for (let i = 0; i < FLOW_LINES; i++) {
      const y = yMin + (i / (FLOW_LINES - 1)) * (yMax - yMin)
      result.push([
        new THREE.Vector3(-CHORD_LENGTH * 1.35, y, 0),
        new THREE.Vector3(CHORD_LENGTH * 1.35, y, 0),
      ])
    }
    return result
  }, [])

  const lineRefs = useRef<THREE.Group[]>([])

  useFrame(() => {
    const cl = morphRef.current?.cl ?? 0.5
    lineRefs.current.forEach((group, i) => {
      if (!group) return
      const yMin = -0.55
      const yMax = 0.55
      const y = yMin + (i / (FLOW_LINES - 1)) * (yMax - yMin)
      const deflect = cl * 0.04 * (1 - Math.abs(y) / 0.6)
      group.position.set(0, deflect, 0)
    })
  })

  return (
    <>
      {lines.map((points, i) => (
        <group key={i} ref={(el) => { if (el) lineRefs.current[i] = el }}>
          <Line
            points={points}
            color="#6366f1"
            transparent
            opacity={0.1 + (i % 2) * 0.03}
            lineWidth={1}
          />
        </group>
      ))}
    </>
  )
}

function AeroVectors({ morphRef }: { morphRef: React.RefObject<MorphState | null> }) {
  const liftLine = useMemo(() => {
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.6, 0),
    ])
    return new THREE.Line(geom, new THREE.LineBasicMaterial({ color: '#86efac' }))
  }, [])
  const dragLine = useMemo(() => {
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.6, 0, 0),
    ])
    return new THREE.Line(geom, new THREE.LineBasicMaterial({ color: '#c9a962' }))
  }, [])
  const liftTip = useMemo(() => {
    return new THREE.Mesh(
      new THREE.ConeGeometry(0.035, 0.08, 8),
      new THREE.MeshBasicMaterial({ color: '#86efac' }),
    )
  }, [])
  const dragTip = useMemo(() => {
    const mesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.035, 0.08, 8),
      new THREE.MeshBasicMaterial({ color: '#c9a962' }),
    )
    mesh.rotation.z = Math.PI / 2
    return mesh
  }, [])

  useEffect(() => {
    return () => {
      liftLine.geometry.dispose()
      dragLine.geometry.dispose()
      ;(liftLine.material as THREE.Material).dispose()
      ;(dragLine.material as THREE.Material).dispose()
      liftTip.geometry.dispose()
      dragTip.geometry.dispose()
      ;(liftTip.material as THREE.Material).dispose()
      ;(dragTip.material as THREE.Material).dispose()
    }
  }, [liftLine, dragLine, liftTip, dragTip])

  useFrame(() => {
    const morph = morphRef.current
    if (!morph) return
    const liftLen = 0.35 + morph.cl * 0.35
    const dragLen = 0.25 + morph.cd * 1.4

    const liftPos = liftLine.geometry.getAttribute('position') as THREE.BufferAttribute
    liftPos.setXYZ(1, 0, liftLen, 0)
    liftPos.needsUpdate = true
    liftTip.position.set(0, liftLen, 0)

    const dragPos = dragLine.geometry.getAttribute('position') as THREE.BufferAttribute
    dragPos.setXYZ(1, -dragLen, 0, 0)
    dragPos.needsUpdate = true
    dragTip.position.set(-dragLen, 0, 0)
  })

  return (
    <group position={[CHORD_LENGTH * 0.08, 0, SPAN_DEPTH * 0.6]}>
      <primitive object={liftLine} />
      <primitive object={liftTip} />
      <primitive object={dragLine} />
      <primitive object={dragTip} />
    </group>
  )
}

function ChordAxis() {
  return (
    <Line
      points={[
        [-CHORD_LENGTH * 0.52, -0.02, 0],
        [CHORD_LENGTH * 0.52, -0.02, 0],
      ]}
      color="#94a3b8"
      transparent
      opacity={0.3}
      lineWidth={1}
      dashed
      dashSize={0.06}
      gapSize={0.05}
    />
  )
}

function AirfoilBody({
  morphRef,
  active,
  progressRef,
}: {
  morphRef: React.RefObject<MorphState | null>
  active: boolean
  progressRef: React.RefObject<number | null>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const wireRef = useRef<THREE.LineSegments>(null)
  const geomRef = useRef<THREE.BufferGeometry | null>(null)
  const edgesRef = useRef<THREE.EdgesGeometry | null>(null)
  const lastKey = useRef('')

  const disposeGeometry = () => {
    geomRef.current?.dispose()
    edgesRef.current?.dispose()
    geomRef.current = null
    edgesRef.current = null
  }

  useEffect(() => () => disposeGeometry(), [])

  useFrame(() => {
    if (!active) return

    const morph = morphRef.current
    if (!morph) return

    const key = `${morph.fromIndex}-${morph.toIndex}-${morph.t.toFixed(3)}`
    if (key !== lastKey.current) {
      lastKey.current = key
      disposeGeometry()
      geomRef.current = buildAirfoilSolidGeometry(morph.morphedPoints, SPAN_DEPTH, morph.cl)
      edgesRef.current = new THREE.EdgesGeometry(geomRef.current, 12)

      if (meshRef.current) meshRef.current.geometry = geomRef.current
      if (wireRef.current) wireRef.current.geometry = edgesRef.current
    }

    const p = smoothstep(progressRef.current ?? 0)
    if (groupRef.current) {
      groupRef.current.rotation.z = THREE.MathUtils.lerp(0, THREE.MathUtils.degToRad(4), p)
      groupRef.current.rotation.y = THREE.MathUtils.lerp(0, 0.12, p)
    }
  })

  const initialGeom = useMemo(
    () => buildAirfoilSolidGeometry(FEATURED_AIRFOIL_PROFILES[0].points, SPAN_DEPTH, 0.82),
    [],
  )
  const initialEdges = useMemo(() => new THREE.EdgesGeometry(initialGeom, 12), [initialGeom])

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} geometry={initialGeom}>
        <meshPhysicalMaterial
          vertexColors
          metalness={0.2}
          roughness={0.35}
          clearcoat={0.5}
          clearcoatRoughness={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments ref={wireRef} geometry={initialEdges}>
        <lineBasicMaterial color="#e2e8f0" transparent opacity={0.4} />
      </lineSegments>
      <ProfileOutline morphRef={morphRef} active={active} />
    </group>
  )
}

function ProfileOutline({
  morphRef,
  active,
}: {
  morphRef: React.RefObject<MorphState | null>
  active: boolean
}) {
  const lineObj = useMemo(() => {
    const geom = new THREE.BufferGeometry()
    geom.setAttribute(
      'position',
      new THREE.BufferAttribute(buildProfileLinePoints(FEATURED_AIRFOIL_PROFILES[0].points), 3),
    )
    return new THREE.Line(
      geom,
      new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }),
    )
  }, [])
  const lastKey = useRef('')

  useEffect(() => () => {
    lineObj.geometry.dispose()
    ;(lineObj.material as THREE.Material).dispose()
  }, [lineObj])

  useFrame(() => {
    if (!active) return
    const morph = morphRef.current
    if (!morph) return

    const key = `${morph.fromIndex}-${morph.toIndex}-${morph.t.toFixed(3)}`
    if (key === lastKey.current) return
    lastKey.current = key

    const pts = buildProfileLinePoints(morph.morphedPoints, SPAN_DEPTH * 0.51)
    const posAttr = lineObj.geometry.getAttribute('position') as THREE.BufferAttribute
    if (posAttr.count * 3 !== pts.length) {
      lineObj.geometry.setAttribute('position', new THREE.BufferAttribute(pts, 3))
    } else {
      posAttr.array.set(pts)
      posAttr.needsUpdate = true
    }
  })

  return <primitive object={lineObj} />
}

function AirfoilScene({ progressRef, active, profiles, onMorphChange }: SceneProps) {
  const morphRef = useRef<MorphState | null>(getMorphState(progressRef.current ?? 0, profiles))

  useFrame(() => {
    const morph = getMorphState(progressRef.current ?? 0, profiles)
    morphRef.current = morph
    onMorphChange?.(morph)
  })

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 4, 6]} intensity={1.0} color="#f8fafc" />
      <directionalLight position={[-4, 1, 3]} intensity={0.3} color="#818cf8" />
      <pointLight position={[0, -1, 4]} intensity={0.15} color="#c9a962" />

      <CameraRig progressRef={progressRef} />

      <group position={[0, 0, 0]}>
        <Grid
          args={[10, 6]}
          cellSize={0.5}
          cellThickness={0.3}
          sectionSize={1.5}
          sectionThickness={0.6}
          fadeDistance={14}
          fadeStrength={1.8}
          cellColor="#2d3748"
          sectionColor="#3d4a5c"
          position={[0, -0.65, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <FlowLines morphRef={morphRef} />
        <ChordAxis />
        <AirfoilBody morphRef={morphRef} active={active} progressRef={progressRef} />
        <AeroVectors morphRef={morphRef} />
      </group>
    </>
  )
}

function TelemetryOverlay({ morph }: { morph: MorphState | null }) {
  if (!morph) return null

  return (
    <div className="airfoil-viewer__telemetry">
      <p className="airfoil-viewer__telemetry-label">Aero telemetry</p>
      <p className="airfoil-viewer__telemetry-profile">{morph.profile.label}</p>
      <dl className="airfoil-viewer__telemetry-grid">
        <div>
          <dt>C<sub>L</sub></dt>
          <dd>{morph.cl.toFixed(2)}</dd>
        </div>
        <div>
          <dt>C<sub>D</sub></dt>
          <dd>{morph.cd.toFixed(3)}</dd>
        </div>
        <div>
          <dt>AoA</dt>
          <dd>{morph.aoa.toFixed(1)}°</dd>
        </div>
        <div>
          <dt>Profile</dt>
          <dd>{morph.activeIndex + 1}/{morph.profileCount}</dd>
        </div>
      </dl>
    </div>
  )
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
  const progressRef = useRef(scrollProgress)
  const fallbackProgress = useMotionValue(scrollProgress)
  const source = progress ?? fallbackProgress
  const profiles = variant === 'featured' ? FEATURED_AIRFOIL_PROFILES : RESEARCH_AIRFOIL_PROFILES
  const [morph, setMorph] = useState<MorphState | null>(() =>
    getMorphState(scrollProgress, profiles),
  )

  useEffect(() => {
    if (!progress) fallbackProgress.set(scrollProgress)
  }, [progress, scrollProgress, fallbackProgress])

  useMotionValueEvent(source, 'change', (v) => {
    progressRef.current = v
    setMorph(getMorphState(v, profiles))
  })

  useEffect(() => {
    if (!progress) {
      progressRef.current = scrollProgress
      setMorph(getMorphState(scrollProgress, profiles))
    }
  }, [progress, scrollProgress, profiles])

  const morphProgress = Math.round((progressRef.current ?? scrollProgress) * 100)

  return (
    <div ref={containerRef} className={`airfoil-viewer ${className}`} aria-hidden="true">
      <div className="airfoil-viewer__frame">
        <Canvas
          camera={{ position: [0, 0.1, 4.6], fov: 38, near: 0.1, far: 50 }}
          dpr={[1, 1.5]}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
          frameloop={isVisible && active ? 'always' : 'demand'}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <AirfoilScene
              progressRef={progressRef}
              active={isVisible && active}
              profiles={profiles}
              onMorphChange={setMorph}
            />
          </Suspense>
        </Canvas>

        <TelemetryOverlay morph={morph} />

        <div className="airfoil-viewer__morph-bar" aria-hidden="true">
          <div
            className="airfoil-viewer__morph-bar-fill"
            style={{ width: `${morphProgress}%` }}
          />
        </div>

        <div className="airfoil-viewer__legend">
          <span className="airfoil-viewer__legend-item airfoil-viewer__legend-item--lift">
            C<sub>L</sub>
          </span>
          <span className="airfoil-viewer__legend-item airfoil-viewer__legend-item--drag">
            C<sub>D</sub>
          </span>
          <span className="airfoil-viewer__legend-item airfoil-viewer__legend-item--flow">
            Flow →
          </span>
        </div>
      </div>
    </div>
  )
}
