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

/**
 * True when the keystroke belongs to something the visitor is typing into —
 * arrow keys move a caret and "b"/"a" are letters, so a form field must never
 * feed the sequence.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function useKonamiCode(onActivate: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return

    let index = 0

    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) {
        index = 0
        return
      }
      if (e.isComposing) return

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
