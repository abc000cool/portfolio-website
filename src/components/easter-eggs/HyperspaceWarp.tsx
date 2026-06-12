import { useEffect, useRef, useState } from 'react'

interface HyperspaceWarpProps {
  active: boolean
  onComplete: () => void
}

export function HyperspaceWarp({ active, onComplete }: HyperspaceWarpProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) return
    setVisible(true)

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width - canvas.width / 2,
      y: Math.random() * canvas.height - canvas.height / 2,
      z: Math.random() * canvas.width,
    }))

    let frame = 0
    const maxFrames = 90
    let animId = 0

    const draw = () => {
      ctx.fillStyle = 'rgba(8, 12, 20, 0.3)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.translate(canvas.width / 2, canvas.height / 2)

      const speed = 1 + frame * 0.15

      for (const star of stars) {
        star.z -= speed
        if (star.z <= 0) {
          star.z = canvas.width
          star.x = Math.random() * canvas.width - canvas.width / 2
          star.y = Math.random() * canvas.height - canvas.height / 2
        }
        const sx = (star.x / star.z) * canvas.width * 0.5
        const sy = (star.y / star.z) * canvas.height * 0.5
        const size = Math.max(0.5, (1 - star.z / canvas.width) * 4)
        ctx.beginPath()
        ctx.arc(sx, sy, size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${1 - star.z / canvas.width})`
        ctx.fill()
      }

      ctx.restore()
      frame++
      if (frame < maxFrames) {
        animId = requestAnimationFrame(draw)
      } else {
        setVisible(false)
        onComplete()
      }
    }

    animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  }, [active, onComplete])

  if (!visible) return null

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 'var(--z-easter-egg)' }}
      aria-hidden="true"
    />
  )
}
