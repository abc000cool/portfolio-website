import { useEffect, useState } from 'react'
import { useIsPhoneLayout } from './useTouchDevice'

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
  const isMobile = useIsPhoneLayout()
  const [displayScale, setDisplayScale] = useState(isMobile ? 1 : 1)

  useEffect(() => {
    const update = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const mobile = vw < 768

      // Phone layout uses responsive sizing — no CSS scale transform (avoids double-compression)
      if (mobile) {
        setDisplayScale(1)
        return
      }

      const base = breakpointScale(vw)
      const peakLidScale = 1.5

      const titleBlock = Math.min(320, vh * 0.34)
      const laptopStack = (192 + 352 + 96 * peakLidScale) * base
      const laptopWidth = 512 * base * peakLidScale

      const heightFit = (vh * 0.92) / (titleBlock + laptopStack)
      const widthFit = (vw * 0.96) / laptopWidth
      const fit = Math.min(1, heightFit, widthFit)

      setDisplayScale(base * fit)
    }

    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return { isMobile, displayScale }
}
