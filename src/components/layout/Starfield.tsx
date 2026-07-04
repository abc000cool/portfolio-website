import { useEffect, useRef } from 'react'
import { useIntersectionPause } from '../../hooks/useIntersectionPause'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useTouchDevice } from '../../hooks/useTouchDevice'

interface Star {
  x: number
  y: number
  size: number
  opacity: number
  speed: number
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isVisible = useIntersectionPause(canvasRef)
  const reduced = useReducedMotion()
  const touch = useTouchDevice()
  const mouseRef = useRef({ x: 0.5, y: 0.5 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const starCount = reduced ? 30 : touch ? 40 : 90

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const stars: Star[] = Array.from({ length: starCount }, () => ({
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
    if (!touch) window.addEventListener('mousemove', onMove)

    let animId = 0
    let shootingStar: { x: number; y: number; len: number; life: number } | null = null

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

      if (!reduced && !touch && Math.random() < 0.0008 && !shootingStar) {
        shootingStar = {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height * 0.5,
          len: 80,
          life: 1,
        }
      }

      if (shootingStar) {
        const { x, y, len, life } = shootingStar
        const grad = ctx.createLinearGradient(x, y, x + len, y + len * 0.3)
        grad.addColorStop(0, `rgba(255,255,255,${life})`)
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.strokeStyle = grad
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + len, y + len * 0.3)
        ctx.stroke()
        shootingStar.life -= 0.03
        shootingStar.x += 8
        shootingStar.y += 2
        if (shootingStar.life <= 0) shootingStar = null
      }

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      if (!touch) window.removeEventListener('mousemove', onMove)
    }
  }, [isVisible, reduced, touch])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 'var(--z-starfield)' }}
      aria-hidden="true"
    />
  )
}
