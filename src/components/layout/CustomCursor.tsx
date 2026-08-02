import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const TRAIL_MAX = 20
const TRAIL_DECAY = 0.05

/** Fine-pointer check, resolved during the first render rather than after it. */
function detectFinePointer() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: fine)').matches
}

/**
 * Crosshair cursor with a fading trail.
 *
 * Previously the trail never rendered for anyone: the effect called
 * setEnabled(true) and then read trailRef.current in the same pass, but the
 * <canvas> only mounts once `enabled` is true - i.e. on the *next* render - so
 * the ref was always null and the draw loop bailed. The effect's deps meant it
 * never ran again. `enabled` is now resolved during the first render, so the
 * canvas exists by the time the effect runs.
 *
 * Pointer position is also written straight to a transform via a ref instead of
 * being held in state, which previously re-rendered React on every mousemove.
 */
export function CustomCursor() {
  const reduced = useReducedMotion()
  const [enabled] = useState(detectFinePointer)
  const [hovering, setHovering] = useState(false)
  const [targeting, setTargeting] = useState(false)

  const trailRef = useRef<HTMLCanvasElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const pointsRef = useRef<{ x: number; y: number; life: number }[]>([])

  const active = enabled && !reduced

  useEffect(() => {
    if (!active) return

    document.body.classList.add('custom-cursor')

    const canvas = trailRef.current
    const ctx = canvas?.getContext('2d')

    // Sized on resize rather than inside the draw loop - assigning width or
    // height resets the canvas, so doing it per frame cleared and reallocated
    // the backing store 60 times a second.
    const sizeCanvas = () => {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    sizeCanvas()
    window.addEventListener('resize', sizeCanvas)

    const onMove = (e: MouseEvent) => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`
      }
      pointsRef.current.push({ x: e.clientX, y: e.clientY, life: 1 })
      if (pointsRef.current.length > TRAIL_MAX) pointsRef.current.shift()
    }

    const onOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      setHovering(Boolean(target.closest('a, button, [data-cursor]')))
      setTargeting(Boolean(target.closest('[data-cursor="target"]')))
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseover', onOver)

    let animId = 0
    const drawTrail = () => {
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        pointsRef.current = pointsRef.current
          .map((p) => ({ ...p, life: p.life - TRAIL_DECAY }))
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
      window.removeEventListener('resize', sizeCanvas)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseover', onOver)
      cancelAnimationFrame(animId)
    }
  }, [active])

  if (!active) return null

  return (
    <>
      <canvas
        ref={trailRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 'var(--z-cursor)' }}
        aria-hidden="true"
      />
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none mix-blend-difference"
        style={{ zIndex: 'var(--z-cursor)' }}
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
