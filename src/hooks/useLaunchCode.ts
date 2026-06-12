import { useEffect } from 'react'

const CODE = 'LAUNCH'

export function useLaunchCode(onActivate: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return

    let buffer = ''

    const handler = (e: KeyboardEvent) => {
      if (e.key.length !== 1) return
      buffer = (buffer + e.key.toUpperCase()).slice(-CODE.length)
      if (buffer === CODE) {
        onActivate()
        buffer = ''
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onActivate, enabled])
}
