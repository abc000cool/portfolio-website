import { useEffect, type ReactNode } from 'react'
import { gsap, ScrollTrigger } from '../../lib/scrollTrigger'
import { useReducedMotion } from '../../hooks/useReducedMotion'

interface ParallaxLayersProps {
  back?: ReactNode
  mid?: ReactNode
  children: ReactNode
}

import { useLightExperience } from '../../hooks/useTouchDevice'

export function ParallaxLayers({ back, mid, children }: ParallaxLayersProps) {
  const reduced = useReducedMotion()
  const light = useLightExperience()

  useEffect(() => {
    if (reduced || light) return

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
          // `scrub: true` is a hard bind to the scrollbar, so every wheel tick
          // and trackpad jitter lands on the backdrop verbatim. A short scrub
          // catches up over ~0.6s: same travel, same range, damped arrival.
          scrub: 0.6,
          // The travel is a function of viewport size; recompute it when the
          // layout is refreshed instead of holding the mount-time value.
          invalidateOnRefresh: true,
        },
      })
      if (tween.scrollTrigger) triggers.push(tween.scrollTrigger)
    })

    return () => triggers.forEach((st) => st.kill())
  }, [reduced, light])

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
      {/* No transform on content - ancestor transforms break position:sticky in Safari */}
      <div className="relative z-[2]">{children}</div>
    </>
  )
}
