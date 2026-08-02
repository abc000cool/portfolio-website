import { useEffect, useRef } from 'react'
import { useIntersectionPause } from '../../hooks/useIntersectionPause'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useLightExperience } from '../../hooks/useTouchDevice'

interface Star {
  x: number
  y: number
  size: number
  opacity: number
  speed: number
}

const STATIC_FIELD =
  'radial-gradient(1px 1px at 20% 30%, rgba(232,236,244,0.35), transparent), radial-gradient(1px 1px at 60% 70%, rgba(232,236,244,0.25), transparent), radial-gradient(1px 1px at 80% 20%, rgba(232,236,244,0.2), transparent)'

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isVisible = useIntersectionPause(canvasRef)
  const reduced = useReducedMotion()
  const light = useLightExperience()
  const mouseRef = useRef({ x: 0.5, y: 0.5 })

  /**
   * A painted canvas needs both a device that can afford it and a reader who
   * wants motion. The previous guard rendered the canvas whenever
   * `light && reduced` but skipped the paint loop for `light` — so a
   * reduced-motion phone got an empty canvas and no background at all.
   */
  const staticField = light || reduced

  useEffect(() => {
    if (staticField) return
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const stars: Star[] = Array.from({ length: 90 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 1.2 + 0.3,
      opacity: Math.random() * 0.35 + 0.08,
      speed: Math.random() * 0.12 + 0.04,
    }))

    const onMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      }
    }
    window.addEventListener('mousemove', onMove)

    let animId = 0

    const draw = () => {
      if (!isVisible) {
        animId = 0
        return
      }

      ctx.fillStyle = 'rgba(6, 6, 10, 0.15)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const mx = (mouseRef.current.x - 0.5) * 20
      const my = (mouseRef.current.y - 0.5) * 20

      for (const star of stars) {
        const x = star.x + mx * star.speed
        const y = star.y + my * star.speed
        ctx.beginPath()
        ctx.arc(x, y, star.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(232, 236, 244, ${star.opacity})`
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
    }
  }, [isVisible, staticField])

  if (staticField) {
    return (
      <div
        className="fixed inset-0 pointer-events-none opacity-60"
        style={{
          zIndex: 'var(--z-starfield)',
          backgroundImage: STATIC_FIELD,
          backgroundSize: '200px 200px, 280px 280px, 240px 240px',
        }}
        aria-hidden="true"
      />
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 'var(--z-starfield)' }}
      aria-hidden="true"
    />
  )
}
