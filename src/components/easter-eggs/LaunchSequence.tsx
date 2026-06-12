import { useEffect, useState } from 'react'
import { gsap } from '../../lib/scrollTrigger'

interface LaunchSequenceProps {
  active: boolean
  onComplete: () => void
}

export function LaunchSequence({ active, onComplete }: LaunchSequenceProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) return
    setVisible(true)

    const tl = gsap.timeline({
      onComplete: () => {
        setVisible(false)
        onComplete()
      },
    })

    tl.fromTo(
      '.launch-rocket',
      { y: '100vh', x: '50vw', opacity: 1 },
      { y: '-20vh', x: '60vw', duration: 2, ease: 'power2.in' },
    )
    tl.fromTo(
      '.launch-trail',
      { opacity: 0.8, scaleY: 0 },
      { opacity: 0, scaleY: 1, duration: 1.5, ease: 'power1.out' },
      0.3,
    )

    return () => {
      tl.kill()
    }
  }, [active, onComplete])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 'var(--z-easter-egg)' }}
      aria-hidden="true"
    >
      <svg className="launch-rocket absolute" width="40" height="60" viewBox="0 0 40 60">
        <polygon points="20,0 28,20 20,16 12,20" fill="#e8a317" />
        <rect x="16" y="20" width="8" height="25" fill="#b8bfca" />
        <ellipse cx="20" cy="48" rx="6" ry="4" fill="#4a7cff" opacity="0.8" />
      </svg>
      <div
        className="launch-trail absolute w-1 h-20 bg-gradient-to-t from-orange-500 to-transparent origin-bottom"
        style={{ left: '50%', bottom: '0' }}
      />
    </div>
  )
}
