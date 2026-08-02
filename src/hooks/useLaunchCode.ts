import { useEffect } from 'react'

const CODE = 'LAUNCH'

/**
 * True when the keystroke belongs to something the visitor is typing into.
 * This site is about launch vehicles: without this check, writing "I work on
 * launch vehicles" in the contact form fires a full-screen rocket sequence
 * mid-sentence, at the exact moment of highest intent.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function useLaunchCode(onActivate: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return

    let buffer = ''

    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) {
        buffer = ''
        return
      }
      if (e.isComposing) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
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
