import { useSyncExternalStore } from 'react'
import { useIsPhoneLayout } from './useTouchDevice'

function breakpointScale(width: number): number {
  if (width < 640) return 0.48
  if (width < 768) return 0.62
  return 1
}

/**
 * Read straight from the window so the very first painted frame already carries
 * the final scale. Deriving this in an effect painted the intro at scale 1 for
 * one frame and then snapped it down, and that snap was the first motion anyone
 * saw on the site.
 */
function readDisplayScale(): number {
  if (typeof window === 'undefined') return 1

  const vw = window.innerWidth
  const vh = window.innerHeight

  // Phone layout uses responsive sizing - no CSS scale transform (avoids double-compression)
  if (vw < 768) return 1

  const base = breakpointScale(vw)
  const peakLidScale = 1.5

  const titleBlock = Math.min(320, vh * 0.34)
  const laptopStack = (192 + 352 + 96 * peakLidScale) * base
  const laptopWidth = 512 * base * peakLidScale

  const heightFit = (vh * 0.92) / (titleBlock + laptopStack)
  const widthFit = (vw * 0.96) / laptopWidth
  const fit = Math.min(1, heightFit, widthFit)

  // Quantised so the snapshot is referentially stable across renders and so
  // sub-pixel resize noise cannot churn the intro.
  return Math.round(base * fit * 1e4) / 1e4
}

function subscribeViewport(onChange: () => void): () => void {
  window.addEventListener('resize', onChange)
  window.addEventListener('orientationchange', onChange)
  return () => {
    window.removeEventListener('resize', onChange)
    window.removeEventListener('orientationchange', onChange)
  }
}

/**
 * Shrinks the intro scene only when the laptop would clip the viewport.
 * Does not alter scroll keyframes or animation timing.
 */
export function useIntroViewport(): { isMobile: boolean; displayScale: number } {
  const isMobile = useIsPhoneLayout()
  const displayScale = useSyncExternalStore(subscribeViewport, readDisplayScale, () => 1)

  return { isMobile, displayScale }
}
