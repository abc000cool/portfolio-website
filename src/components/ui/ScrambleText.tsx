import { useEffect, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>/'

/**
 * Short on purpose - this runs on a name in the hero, and a name that takes
 * over a second to become readable is a gimmick rather than a flourish.
 */
const SCRAMBLE_DURATION = 620

/**
 * Glyph churn slows as the word resolves (fast flicker -> lazy flicker). This
 * is what softens the settle: the final character stops changing gradually
 * instead of snapping out of a strobe on the last frame.
 */
const ROLL_MIN = 34
const ROLL_MAX = 88

/**
 * Lets the resolve front run just past the last character, so the word is
 * fully settled a beat before the animation ends rather than exactly on it.
 */
const FRONT_OVERSHOOT = 0.6

interface ScrambleTextProps {
  text: string
  className?: string
}

export function ScrambleText({ text, className = '' }: ScrambleTextProps) {
  const [display, setDisplay] = useState(text)
  const [lastText, setLastText] = useState(text)
  const reduced = useReducedMotion()

  // React's documented render-phase adjustment. This used to be a setState
  // inside the effect, which cost an extra render pass and showed one frame of
  // scrambled glyphs to readers who asked for reduced motion.
  if (text !== lastText) {
    setLastText(text)
    setDisplay(text)
  }

  useEffect(() => {
    if (reduced) return

    const chars = text.split('')
    const len = chars.length
    if (len === 0) return

    let raf = 0
    let startedAt = 0
    let lastRoll = 0
    let painted = text

    const step = (now: number) => {
      if (startedAt === 0) startedAt = now
      const p = Math.min(1, (now - startedAt) / SCRAMBLE_DURATION)

      // Ease-out on the resolve front, which is what makes this read as a
      // left-to-right lock-in rather than a uniform sweep: the opening
      // characters snap into place immediately and the trailing ones drift in.
      const front = (1 - Math.pow(1 - p, 2)) * (len + FRONT_OVERSHOOT)

      // Re-roll the unresolved glyphs on their own decelerating clock, not
      // every frame. At 144Hz an every-frame re-roll is an unreadable strobe.
      const rollInterval = ROLL_MIN + (ROLL_MAX - ROLL_MIN) * p
      if (now - lastRoll < rollInterval && p < 1) {
        raf = requestAnimationFrame(step)
        return
      }
      lastRoll = now

      let next = ''
      for (let i = 0; i < len; i++) {
        const char = chars[i]
        // Spaces never scramble, so word shape holds steady throughout and the
        // line does not appear to reflow while it resolves.
        if (char === ' ' || p === 1 || i < front) next += char
        else next += GLYPHS[(Math.random() * GLYPHS.length) | 0]
      }

      if (next !== painted) {
        painted = next
        setDisplay(next)
      }

      if (p < 1) raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [text, reduced])

  return (
    <span className={className} aria-label={text}>
      {display}
    </span>
  )
}
