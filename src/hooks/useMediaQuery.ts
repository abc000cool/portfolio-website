import { useSyncExternalStore } from 'react'

function subscribeMediaQuery(query: string, onChange: () => void): () => void {
  const mq = window.matchMedia(query)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/** SSR-safe media query hook without setState-in-effect. */
export function useMediaQuery(query: string, serverFallback = false): boolean {
  return useSyncExternalStore(
    (onChange) => subscribeMediaQuery(query, onChange),
    () => window.matchMedia(query).matches,
    () => serverFallback,
  )
}
