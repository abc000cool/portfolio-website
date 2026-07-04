import { useMediaQuery } from './useMediaQuery'

/** True for phones/tablets with coarse pointer (touch-primary devices). */
export function useTouchDevice(): boolean {
  return useMediaQuery('(pointer: coarse)', false)
}

/** Layout breakpoint used for simplified mobile experiences. */
export function useIsMobileLayout(): boolean {
  return useMediaQuery('(max-width: 1023px)', false)
}

/** Phone-sized viewport — stacked cards, no heavy 3D scroll zones. */
export function useIsPhoneLayout(): boolean {
  return useMediaQuery('(max-width: 767px)', false)
}

function detectSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg/i.test(ua)
}

/** Use native scroll instead of Lenis — touch devices and Safari (desktop + mobile). */
export function usePreferNativeScroll(): boolean {
  const touch = useTouchDevice()
  return touch || detectSafari()
}
