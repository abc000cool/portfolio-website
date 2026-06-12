import { useEffect, useState } from 'react'

function breakpointScale(width: number): number {
  if (width < 640) return 0.48
  if (width < 768) return 0.62
  return 1
}

/**
 * Shrinks the intro scene only when the laptop would clip the viewport.
 * Does not alter scroll keyframes or animation timing.
 */
export function useIntroViewport(): { isMobile: boolean; displayScale: number } {
  const [metrics, setMetrics] = useState({ isMobile: false, displayScale: 1 })

  useEffect(() => {
    const update = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const isMobile = vw < 768
      const base = breakpointScale(vw)
      const peakLidScale = isMobile ? 1 : 1.5

      const titleBlock = Math.min(320, vh * 0.34)
      const laptopStack = (192 + 352 + 96 * peakLidScale) * base
      const laptopWidth = 512 * base * peakLidScale

      const heightFit = (vh * 0.92) / (titleBlock + laptopStack)
      const widthFit = (vw * 0.96) / laptopWidth
      const fit = Math.min(1, heightFit, widthFit)

      setMetrics({
        isMobile,
        displayScale: base * fit,
      })
    }

    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return metrics
}
