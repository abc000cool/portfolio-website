import { useEffect, useRef, type ReactNode } from 'react'
import { gsap } from '../../lib/scrollTrigger'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useLightExperience } from '../../hooks/useTouchDevice'

interface ParallaxLayersProps {
  back?: ReactNode
  children: ReactNode
}

/*
 * There used to be a `mid` layer here: six "+" glyphs at 0.08 alpha — invisible
 * in practice, but each one carried its own scroll-scrubbed ScrollTrigger. It
 * was removed along with its last call site in HomePage.
 */

/**
 * Stacking contract for the homepage. Everything that needs to sit in front of
 * or behind the content agrees on these three numbers:
 *
 *   0  ambient back layer (fixed, non-interactive)
 *   2  content — one stacking context wrapping every section
 *   3  flight-path waypoint layer (FlightPath, a sibling of this component)
 *
 * The content wrapper is a stacking context, so nothing inside a section can
 * climb above the flight path's waypoints; the flight path opts out of hit
 * testing at its <svg> root and back in per waypoint group.
 */
const BACK_Z = 0
const CONTENT_Z = 2

export function ParallaxLayers({ back, children }: ParallaxLayersProps) {
  const backRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const light = useLightExperience()

  useEffect(() => {
    if (reduced || light) return

    const layer = backRef.current
    if (!layer) return

    const depth = parseFloat(layer.dataset.parallaxDepth ?? '0.5')
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

    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [reduced, light])

  return (
    <>
      {back && (
        <div
          ref={backRef}
          data-parallax-depth="0.2"
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex: BACK_Z }}
          aria-hidden="true"
        >
          {back}
        </div>
      )}
      {/* No transform on content — ancestor transforms break position:sticky in Safari */}
      <div className="relative" style={{ zIndex: CONTENT_Z }}>
        {children}
      </div>
    </>
  )
}
