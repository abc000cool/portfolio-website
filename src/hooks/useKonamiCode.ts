import { useEffect } from 'react'

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
]

export function useKonamiCode(onActivate: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return

    let index = 0

    const handler = (e: KeyboardEvent) => {
      if (e.key === KONAMI[index]) {
        index++
        if (index === KONAMI.length) {
          onActivate()
          index = 0
        }
      } else {
        index = e.key === KONAMI[0] ? 1 : 0
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onActivate, enabled])
}
