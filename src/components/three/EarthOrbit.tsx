import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useIntersectionPause } from '../../hooks/useIntersectionPause'
import * as THREE from 'three'

function Earth({ active }: { active: boolean }) {
  const earthRef = useRef<THREE.Mesh>(null)
  const orbitRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (!active) return
    if (earthRef.current) earthRef.current.rotation.y += 0.002
    if (orbitRef.current) orbitRef.current.rotation.z += 0.001
  })

  return (
    <>
      <mesh ref={earthRef}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial color="#4a7cff" wireframe transparent opacity={0.4} />
      </mesh>
      <mesh ref={orbitRef} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[1.8, 0.01, 8, 100]} />
        <meshBasicMaterial color="#e8a317" transparent opacity={0.6} />
      </mesh>
      <mesh rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[1.8, 0.005, 8, 100]} />
        <meshBasicMaterial color="#3dff8a" transparent opacity={0.3} />
      </mesh>
    </>
  )
}

export function EarthOrbit({ className = '' }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isVisible = useIntersectionPause(containerRef)

  return (
    <div ref={containerRef} className={className}>
      <Canvas camera={{ position: [0, 0, 4], fov: 50 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
        <Suspense fallback={null}>
          <Earth active={isVisible} />
        </Suspense>
      </Canvas>
    </div>
  )
}
