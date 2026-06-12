import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

export function CustomCursor() {
  const reduced = useReducedMotion()
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [hovering, setHovering] = useState(false)
  const [targeting, setTargeting] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const trailRef = useRef<HTMLCanvasElement>(null)
  const pointsRef = useRef<{ x: number; y: number; life: number }[]>([])

  useEffect(() => {
    if (reduced) return
    const finePointer = window.matchMedia('(pointer: fine)').matches
    if (!finePointer) return
    setEnabled(true)

    document.body.classList.add('custom-cursor')

    const onMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY })
      pointsRef.current.push({ x: e.clientX, y: e.clientY, life: 1 })
      if (pointsRef.current.length > 20) pointsRef.current.shift()
    }

    const onOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const interactive = target.closest('a, button, [data-cursor]')
      setHovering(!!interactive)
      setTargeting(!!target.closest('[data-cursor="target"]'))
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseover', onOver)

    const canvas = trailRef.current
    const ctx = canvas?.getContext('2d')
    let animId = 0

    const drawTrail = () => {
      if (canvas && ctx) {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        pointsRef.current = pointsRef.current
          .map((p) => ({ ...p, life: p.life - 0.05 }))
          .filter((p) => p.life > 0)
        for (const p of pointsRef.current) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, 2 * p.life, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(199, 210, 254, ${p.life * 0.35})`
          ctx.fill()
        }
      }
      animId = requestAnimationFrame(drawTrail)
    }
    animId = requestAnimationFrame(drawTrail)

    return () => {
      document.body.classList.remove('custom-cursor')
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseover', onOver)
      cancelAnimationFrame(animId)
    }
  }, [reduced])

  if (reduced || !enabled) return null

  return (
    <>
      <canvas
        ref={trailRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 'var(--z-cursor)' }}
        aria-hidden="true"
      />
      <div
        className="fixed pointer-events-none mix-blend-difference"
        style={{
          zIndex: 'var(--z-cursor)',
          left: pos.x,
          top: pos.y,
          transform: 'translate(-50%, -50%)',
        }}
        aria-hidden="true"
      >
        {targeting ? (
          <svg width="32" height="32" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="12" fill="none" stroke="#a5b4fc" strokeWidth="1" />
            <line x1="16" y1="0" x2="16" y2="8" stroke="#a5b4fc" strokeWidth="1" />
            <line x1="16" y1="24" x2="16" y2="32" stroke="#a5b4fc" strokeWidth="1" />
            <line x1="0" y1="16" x2="8" y2="16" stroke="#a5b4fc" strokeWidth="1" />
            <line x1="24" y1="16" x2="32" y2="16" stroke="#a5b4fc" strokeWidth="1" />
          </svg>
        ) : (
          <>
            <div
              className="absolute rounded-full border border-[var(--color-accent-soft)] transition-all duration-200"
              style={{
                width: hovering ? 32 : 20,
                height: hovering ? 32 : 20,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                opacity: 0.5,
              }}
            />
            <div className="w-px h-4 bg-[var(--color-accent-soft)] absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
            <div className="w-4 h-px bg-[var(--color-accent-soft)] absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
          </>
        )}
      </div>
    </>
  )
}
