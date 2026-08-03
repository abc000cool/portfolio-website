import { useEffect, useRef } from 'react'
import { useIntersectionPause } from '../../hooks/useIntersectionPause'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useLightExperience } from '../../hooks/useTouchDevice'

interface Star {
  x: number
  y: number
  size: number
  opacity: number
  /** Depth tier index into PARALLAX / DRIFT. */
  tier: number
  /** Twinkle phase and rate, so no two stars breathe together. */
  phase: number
  rate: number
}

const STAR_COUNT = 90

/**
 * Three genuine depth tiers. The old field gave every star a random factor in
 * a 0.04-0.16 band multiplied by 20px, so the whole sky moved as one sheet of
 * 1-3px. Separating the tiers by roughly 2.5x each makes the depth readable.
 */
const PARALLAX = [0.1, 0.26, 0.52]
/** Downward drift in px per second, matched to the same depth order. */
const DRIFT = [0.35, 1.1, 2.6]
const SIZE = [0.35, 0.7, 1.15]
const BRIGHTNESS = [0.5, 0.78, 1]

const MOUSE_RANGE = 26
/** Mouse follow rate in e-foldings per second. */
const MOUSE_RATE = 5
const MAX_DT = 0.05

const STATIC_FIELD =
  'radial-gradient(1px 1px at 20% 30%, rgba(232,236,244,0.35), transparent), radial-gradient(1px 1px at 60% 70%, rgba(232,236,244,0.25), transparent), radial-gradient(1px 1px at 80% 20%, rgba(232,236,244,0.2), transparent)'

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isVisible = useIntersectionPause(canvasRef)
  const reduced = useReducedMotion()
  const light = useLightExperience()
  const mouseRef = useRef({ x: 0.5, y: 0.5 })
  /**
   * The field itself outlives a visibility pause. Rebuilding it inside the
   * paint effect meant every scroll-away/scroll-back reshuffled all 90 stars
   * in a single frame - the most visible pop on the page.
   */
  const starsRef = useRef<Star[] | null>(null)
  const smoothMouseRef = useRef({ x: 0.5, y: 0.5 })

  /**
   * A painted canvas needs both a device that can afford it and a reader who
   * wants motion. The previous guard rendered the canvas whenever
   * `light && reduced` but skipped the paint loop for `light` - so a
   * reduced-motion phone got an empty canvas and no background at all.
   */
  const staticField = light || reduced

  useEffect(() => {
    if (staticField) return
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = window.innerWidth
    let height = window.innerHeight

    const build = () => {
      starsRef.current = Array.from({ length: STAR_COUNT }, () => {
        const roll = Math.random()
        const tier = roll < 0.45 ? 0 : roll < 0.8 ? 1 : 2
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          size: SIZE[tier] + Math.random() * 0.45,
          opacity: (Math.random() * 0.22 + 0.13) * BRIGHTNESS[tier],
          tier,
          phase: Math.random() * Math.PI * 2,
          rate: 0.35 + Math.random() * 0.9,
        }
      })
    }

    const resize = () => {
      const nextW = window.innerWidth
      const nextH = window.innerHeight
      const stars = starsRef.current
      // Rescale rather than re-randomize: a resize should not restart the sky.
      if (stars && width > 0 && height > 0) {
        const sx = nextW / width
        const sy = nextH / height
        for (const star of stars) {
          star.x *= sx
          star.y *= sy
        }
      }
      width = nextW
      height = nextH
      // Assigning width/height clears the canvas, so only do it on a real
      // change - otherwise every visibility toggle flashes the sky to black.
      if (canvas.width !== nextW) canvas.width = nextW
      if (canvas.height !== nextH) canvas.height = nextH
    }

    resize()
    if (!starsRef.current) build()
    window.addEventListener('resize', resize)

    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX / window.innerWidth
      mouseRef.current.y = e.clientY / window.innerHeight
    }
    window.addEventListener('mousemove', onMove)

    let animId = 0
    let last = 0
    let elapsed = 0

    const draw = (now: number) => {
      if (!isVisible) {
        animId = 0
        return
      }

      const dt = Math.min(MAX_DT, Math.max(0, (now - last) / 1000))
      last = now
      elapsed += dt

      const stars = starsRef.current
      if (!stars) {
        animId = requestAnimationFrame(draw)
        return
      }

      // Raw pointer position is jumpy; easing it means the parallax glides
      // instead of snapping when the pointer jumps across the viewport.
      const sm = smoothMouseRef.current
      const k = 1 - Math.exp(-MOUSE_RATE * dt)
      sm.x += (mouseRef.current.x - sm.x) * k
      sm.y += (mouseRef.current.y - sm.y) * k

      ctx.fillStyle = 'rgba(6, 6, 10, 0.15)'
      ctx.fillRect(0, 0, width, height)

      const mx = (sm.x - 0.5) * MOUSE_RANGE
      const my = (sm.y - 0.5) * MOUSE_RANGE

      for (const star of stars) {
        const tier = star.tier
        // Drift wraps well outside the visible edge, so a star is never on
        // screen at the moment it is repositioned - no visible jump.
        star.y += DRIFT[tier] * dt
        if (star.y > height + 16) {
          star.y -= height + 32
          star.x = Math.random() * width
        }

        const par = PARALLAX[tier]
        const x = star.x + mx * par
        const y = star.y + my * par
        const twinkle = 0.82 + 0.18 * Math.sin(elapsed * star.rate + star.phase)

        ctx.beginPath()
        ctx.arc(x, y, star.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(232, 236, 244, ${star.opacity * twinkle})`
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }

    const start = (now: number) => {
      // Seed the clock on the first real frame so a pause never integrates as
      // one giant delta on resume.
      last = now
      draw(now)
    }

    animId = requestAnimationFrame(start)

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
