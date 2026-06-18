import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Grid, Html, Line } from '@react-three/drei'
import { useMotionValueEvent, useMotionValue, type MotionValue } from 'motion/react'
import * as THREE from 'three'
import { useIntersectionPause } from '../../hooks/useIntersectionPause'
import {
  RESEARCH_AIRFOIL_PROFILES,
  buildExtrudedAirfoilGeometry,
  buildProfileLinePoints,
  getMorphState,
  type MorphState,
} from '../../lib/airfoilGeometry'

const FLOW_LINES = 7
const EXTRUSION_DEPTH = 0.38

interface SceneProps {
  progressRef: React.RefObject<number | null>
  active: boolean
}

function FlowLines({ morphRef }: { morphRef: React.RefObject<MorphState | null> }) {
  const lines = useMemo(() => {
    const result: [THREE.Vector3, THREE.Vector3][] = []
    for (let i = 0; i < FLOW_LINES; i++) {
      const y = -1.2 + (i / (FLOW_LINES - 1)) * 2.4
      result.push([new THREE.Vector3(-3.2, y, 0), new THREE.Vector3(3.2, y, 0)])
    }
    return result
  }, [])

  const lineRefs = useRef<THREE.Group[]>([])

  useFrame(() => {
    const cl = morphRef.current?.cl ?? 0.5
    lineRefs.current.forEach((group, i) => {
      if (!group) return
      const y = -1.2 + (i / (FLOW_LINES - 1)) * 2.4
      const deflect = cl * 0.08 * (1 - Math.abs(y) / 1.4)
      group.position.set(0, deflect * 0.35, 0)
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
            opacity={0.12 + (i % 2) * 0.04}
            lineWidth={1}
          />
        </group>
      ))}
    </>
  )
}

function AeroVectors({ morphRef }: { morphRef: React.RefObject<MorphState | null> }) {
  const groupRef = useRef<THREE.Group>(null)
  const liftLine = useMemo(() => {
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0),
    ])
    return new THREE.Line(geom, new THREE.LineBasicMaterial({ color: '#86efac' }))
  }, [])
  const dragLine = useMemo(() => {
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-1, 0, 0),
    ])
    return new THREE.Line(geom, new THREE.LineBasicMaterial({ color: '#c9a962' }))
  }, [])
  const liftTip = useMemo(() => {
    const mesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.14, 8),
      new THREE.MeshBasicMaterial({ color: '#86efac' }),
    )
    return mesh
  }, [])
  const dragTip = useMemo(() => {
    const mesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.14, 8),
      new THREE.MeshBasicMaterial({ color: '#c9a962' }),
    )
    mesh.rotation.z = -Math.PI / 2
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
    const liftLen = 0.55 + morph.cl * 0.55
    const dragLen = 0.45 + morph.cd * 2.2

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
    <group ref={groupRef} position={[0.15, 0.05, 0]}>
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
        [-1.35, -0.02, 0],
        [1.35, -0.02, 0],
      ]}
      color="#94a3b8"
      transparent
      opacity={0.35}
      lineWidth={1}
      dashed
      dashSize={0.08}
      gapSize={0.06}
    />
  )
}

function AirfoilBody({
  morphRef,
  active,
}: {
  morphRef: React.RefObject<MorphState | null>
  active: boolean
}) {
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

  useFrame((state) => {
    if (!active) return

    const morph = morphRef.current
    if (!morph) return

    const key = `${morph.fromIndex}-${morph.toIndex}-${morph.t.toFixed(3)}`
    if (key !== lastKey.current) {
      lastKey.current = key
      disposeGeometry()
      geomRef.current = buildExtrudedAirfoilGeometry(
        morph.morphedPoints,
        EXTRUSION_DEPTH,
        morph.cl,
      )
      edgesRef.current = new THREE.EdgesGeometry(geomRef.current, 18)

      if (meshRef.current) meshRef.current.geometry = geomRef.current
      if (wireRef.current) wireRef.current.geometry = edgesRef.current
    }

    const t = state.clock.elapsedTime
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(t * 0.35) * 0.12
      meshRef.current.rotation.z = Math.sin(t * 0.22) * 0.03
    }
  })

  const initialGeom = useMemo(
    () => buildExtrudedAirfoilGeometry(RESEARCH_AIRFOIL_PROFILES[0].points, EXTRUSION_DEPTH, 0.12),
    [],
  )
  const initialEdges = useMemo(() => new THREE.EdgesGeometry(initialGeom, 18), [initialGeom])

  return (
    <group>
      <mesh ref={meshRef} geometry={initialGeom} castShadow receiveShadow>
        <meshPhysicalMaterial
          vertexColors
          metalness={0.35}
          roughness={0.28}
          clearcoat={0.65}
          clearcoatRoughness={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments ref={wireRef} geometry={initialEdges}>
        <lineBasicMaterial color="#e2e8f0" transparent opacity={0.55} />
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
      new THREE.BufferAttribute(buildProfileLinePoints(RESEARCH_AIRFOIL_PROFILES[0].points), 3),
    )
    return new THREE.Line(geom, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }))
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

    const pts = buildProfileLinePoints(morph.morphedPoints, EXTRUSION_DEPTH / 2 + 0.02)
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

function TelemetryPanel({ morphRef }: { morphRef: React.RefObject<MorphState | null> }) {
  const labelRef = useRef<HTMLSpanElement>(null)
  const clRef = useRef<HTMLSpanElement>(null)
  const cdRef = useRef<HTMLSpanElement>(null)
  const aoaRef = useRef<HTMLSpanElement>(null)
  const idxRef = useRef<HTMLSpanElement>(null)

  useFrame(() => {
    const morph = morphRef.current
    if (!morph) return
    if (labelRef.current) labelRef.current.textContent = morph.profile.label
    if (clRef.current) clRef.current.textContent = morph.cl.toFixed(2)
    if (cdRef.current) cdRef.current.textContent = morph.cd.toFixed(3)
    if (aoaRef.current) aoaRef.current.textContent = `${morph.aoa.toFixed(1)}°`
    if (idxRef.current) {
      idxRef.current.textContent = `${morph.activeIndex + 1}/${RESEARCH_AIRFOIL_PROFILES.length}`
    }
  })

  return (
    <Html
      position={[-2.1, 1.55, 0]}
      transform
      occlude={false}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <div className="airfoil-telemetry">
        <p className="airfoil-telemetry__label">Aero telemetry</p>
        <p className="airfoil-telemetry__profile">
          <span ref={labelRef}>{RESEARCH_AIRFOIL_PROFILES[0].label}</span>
        </p>
        <dl className="airfoil-telemetry__grid">
          <div>
            <dt>C<sub>L</sub></dt>
            <dd ref={clRef}>0.12</dd>
          </div>
          <div>
            <dt>C<sub>D</sub></dt>
            <dd ref={cdRef}>0.420</dd>
          </div>
          <div>
            <dt>AoA</dt>
            <dd ref={aoaRef}>0.0°</dd>
          </div>
          <div>
            <dt>Profile</dt>
            <dd ref={idxRef}>1/4</dd>
          </div>
        </dl>
      </div>
    </Html>
  )
}

function AirfoilScene({ progressRef, active }: SceneProps) {
  const morphRef = useRef<MorphState | null>(getMorphState(progressRef.current ?? 0))

  useFrame(() => {
    morphRef.current = getMorphState(progressRef.current ?? 0)
  })

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 6, 5]} intensity={1.1} color="#f8fafc" />
      <directionalLight position={[-3, 2, -4]} intensity={0.35} color="#818cf8" />
      <pointLight position={[0, -2, 3]} intensity={0.25} color="#c9a962" />

      <group position={[0, -0.05, 0]}>
        <Grid
          args={[8, 8]}
          cellSize={0.4}
          cellThickness={0.35}
          sectionSize={1.6}
          sectionThickness={0.8}
          fadeDistance={12}
          fadeStrength={1.5}
          cellColor="#334155"
          sectionColor="#475569"
          position={[0, -0.55, 0]}
          rotation={[0, 0, 0]}
        />
        <FlowLines morphRef={morphRef} />
        <ChordAxis />
        <AirfoilBody morphRef={morphRef} active={active} />
        <AeroVectors morphRef={morphRef} />
        <TelemetryPanel morphRef={morphRef} />
      </group>
    </>
  )
}

export interface MorphingAirfoilProps {
  scrollProgress?: number
  progress?: MotionValue<number>
  active?: boolean
  className?: string
}

export function MorphingAirfoil({
  scrollProgress = 0,
  progress,
  active = true,
  className = '',
}: MorphingAirfoilProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isVisible = useIntersectionPause(containerRef)
  const progressRef = useRef(scrollProgress)
  const fallbackProgress = useMotionValue(scrollProgress)
  const source = progress ?? fallbackProgress

  useEffect(() => {
    if (!progress) fallbackProgress.set(scrollProgress)
  }, [progress, scrollProgress, fallbackProgress])

  useMotionValueEvent(source, 'change', (v) => {
    progressRef.current = v
  })

  return (
    <div ref={containerRef} className={`airfoil-viewer ${className}`} aria-hidden="true">
      <div className="airfoil-viewer__frame">
        <Canvas
          camera={{ position: [0, 0.35, 4.8], fov: 42 }}
          dpr={[1, 1.75]}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
          frameloop={isVisible && active ? 'always' : 'demand'}
        >
          <Suspense fallback={null}>
            <AirfoilScene progressRef={progressRef} active={isVisible && active} />
          </Suspense>
        </Canvas>
        <div className="airfoil-viewer__legend">
          <span className="airfoil-viewer__legend-item airfoil-viewer__legend-item--lift">
            C<sub>L</sub> lift
          </span>
          <span className="airfoil-viewer__legend-item airfoil-viewer__legend-item--drag">
            C<sub>D</sub> drag
          </span>
          <span className="airfoil-viewer__legend-item airfoil-viewer__legend-item--flow">
            Flow →
          </span>
        </div>
      </div>
    </div>
  )
}
