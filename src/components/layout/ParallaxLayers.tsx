import { useEffect, type ReactNode } from 'react'
import { gsap, ScrollTrigger } from '../../lib/scrollTrigger'
import { useReducedMotion } from '../../hooks/useReducedMotion'

interface ParallaxLayersProps {
  back?: ReactNode
  mid?: ReactNode
  children: ReactNode
}

export function ParallaxLayers({ back, mid, children }: ParallaxLayersProps) {
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return

    const triggers: ScrollTrigger[] = []
    const layers = document.querySelectorAll('[data-parallax-depth]')
    layers.forEach((layer) => {
      const depth = parseFloat(layer.getAttribute('data-parallax-depth') ?? '0.5')
      const tween = gsap.to(layer, {
        y: () => -(1 - depth) * 150,
        ease: 'none',
        scrollTrigger: {
          trigger: document.body,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
        },
      })
      if (tween.scrollTrigger) triggers.push(tween.scrollTrigger)
    })

    return () => triggers.forEach((st) => st.kill())
  }, [reduced])

  return (
    <>
      {/* z-index 0: below the flight path (1) and section content (2) */}
      {back && (
        <div
          data-parallax-depth="0.2"
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex: 0 }}
        >
          {back}
        </div>
      )}
      {mid && (
        <div
          data-parallax-depth="0.5"
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex: 0 }}
        >
          {mid}
        </div>
      )}
      <div data-parallax-depth="1">{children}</div>
    </>
  )
}
