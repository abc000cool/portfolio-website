import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const TRAIL_MAX = 20

/**
 * Life lost per SECOND, not per frame.
 *
 * The trail used to subtract a flat 0.05 every frame, which is only a decay
 * rate if you assume 60Hz forever: the same trail lasted 333ms on a 60Hz panel
 * and 139ms on a 144Hz one, so the effect quietly got shorter and stingier on
 * exactly the hardware most likely to be looking at it. 3.0/sec reproduces the
 * old 60Hz timing exactly while now being identical on every display.
 */
const TRAIL_DECAY_PER_SECOND = 3

/**
 * Longest delta the decay will act on. A backgrounded tab parks rAF, and the
 * first frame after it resumes can carry a multi-second delta - without a clamp
 * that single frame wipes the whole trail at once, which reads as a glitch.
 */
const MAX_DELTA = 0.05

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

  // Fixed-size ring buffer of point objects, allocated once. The draw loop used
  // to rebuild the trail every frame with `.map(p => ({...p}))` followed by a
  // `.filter()`, which handed the GC two arrays and up to twenty objects per
  // frame, forever, purely to decrement one number on each of them.
  const pointsRef = useRef(
    Array.from({ length: TRAIL_MAX }, () => ({ x: 0, y: 0, life: 0 })),
  )
  const headRef = useRef(0)
  const hoveringRef = useRef(false)
  const targetingRef = useRef(false)

  const active = enabled && !reduced

  useEffect(() => {
    if (!active) return

    document.body.classList.add('custom-cursor')

    const canvas = trailRef.current
    const ctx = canvas?.getContext('2d')

    // Sized on resize rather than inside the draw loop - assigning width or
    // height resets the canvas, so doing it per frame cleared and reallocated
    // the backing store 60 times a second.
    let cssWidth = 0
    let cssHeight = 0

    const sizeCanvas = () => {
      if (!canvas || !ctx) return
      // Measured from the element's own laid-out box rather than innerWidth so
      // the backing store matches whatever `inset-0` actually resolved to, and
      // a classic scrollbar cannot put the drawing surface out of register.
      cssWidth = canvas.clientWidth || window.innerWidth
      cssHeight = canvas.clientHeight || window.innerHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(cssWidth * dpr)
      canvas.height = Math.round(cssHeight * dpr)
      // Assigning width/height resets the context transform, so the DPR scale
      // has to be reapplied here. Everything below then draws in CSS pixels.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    sizeCanvas()
    window.addEventListener('resize', sizeCanvas)

    const onMove = (e: MouseEvent) => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`
      }
      // Overwrite the oldest slot instead of push/shift, so no allocation
      // happens on the hottest event on the page.
      const point = pointsRef.current[headRef.current]
      point.x = e.clientX
      point.y = e.clientY
      point.life = 1
      headRef.current = (headRef.current + 1) % TRAIL_MAX
    }

    const onOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const nextHovering = Boolean(target.closest('a, button, [data-cursor]'))
      const nextTargeting = Boolean(target.closest('[data-cursor="target"]'))
      // mouseover fires on every element boundary crossed. Only touch React
      // state when the answer actually changed.
      if (nextHovering !== hoveringRef.current) {
        hoveringRef.current = nextHovering
        setHovering(nextHovering)
      }
      if (nextTargeting !== targetingRef.current) {
        targetingRef.current = nextTargeting
        setTargeting(nextTargeting)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseover', onOver)

    let animId = 0
    let lastTime = 0
    let hadInk = false

    const drawTrail = (now: number) => {
      if (ctx && canvas) {
        const delta = lastTime === 0 ? 0 : Math.min((now - lastTime) / 1000, MAX_DELTA)
        lastTime = now

        const decay = delta * TRAIL_DECAY_PER_SECOND
        const points = pointsRef.current
        let hasInk = false

        // Only clear when something was actually drawn last frame. A resting
        // pointer otherwise costs a full-viewport clearRect every frame for as
        // long as the page is open.
        if (hadInk) ctx.clearRect(0, 0, cssWidth, cssHeight)

        for (let i = 0; i < points.length; i++) {
          const p = points[i]
          if (p.life <= 0) continue
          p.life -= decay
          if (p.life <= 0) {
            p.life = 0
            continue
          }
          hasInk = true
          ctx.beginPath()
          ctx.arc(p.x, p.y, 2 * p.life, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(199, 210, 254, ${p.life * 0.35})`
          ctx.fill()
        }

        hadInk = hasInk
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
