import { useRef, type ReactNode, type MouseEvent } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useTouchDevice } from '../../hooks/useTouchDevice'

interface MagneticButtonProps {
  children: ReactNode
  onClick?: () => void
  href?: string
  className?: string
  type?: 'button' | 'submit'
  variant?: 'primary' | 'ghost'
}

/** Fraction of the cursor's offset from centre that the button travels. */
const STRENGTH = 0.15

/**
 * Hard cap on the pull. Without it the offset scales with the button's own
 * width, so the widest button on the page wanders furthest - the opposite of
 * what a magnetic effect should feel like.
 */
const MAX_PULL = 10

/**
 * Colour and shadow timing, lifted verbatim from the `transition-all
 * duration-300` this replaces (Tailwind's default easing) so hover styling is
 * untouched. Only the transform timing below is new.
 */
const CHROME =
  'background-color 300ms cubic-bezier(0.4, 0, 0.2, 1), border-color 300ms cubic-bezier(0.4, 0, 0.2, 1), color 300ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1)'

/**
 * Attraction: short enough to feel attached to the cursor, long enough to
 * smooth the raw pointer samples. The old code inherited the 300ms chrome
 * transition for the transform too, which meant the button was always a third
 * of a second behind the cursor - it read as sluggish rather than magnetic.
 */
const PULL = `transform 180ms cubic-bezier(0.33, 1, 0.68, 1), ${CHROME}`

/**
 * Release: noticeably longer than the pull and on an ease-out, so the button
 * coasts back to rest instead of being yanked there.
 */
const RELEASE = `transform 520ms cubic-bezier(0.22, 1, 0.36, 1), ${CHROME}`

function clamp(value: number, limit: number) {
  return Math.max(-limit, Math.min(limit, value))
}

export function MagneticButton({
  children,
  onClick,
  href,
  className = '',
  type = 'button',
  variant = 'primary',
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement & HTMLAnchorElement>(null)
  const reduced = useReducedMotion()
  const touch = useTouchDevice()

  // Touch devices synthesise mouseover/mousemove on tap, which left the button
  // stuck at an offset with no pointer to follow and no mouseleave to release
  // it. There is no cursor to be magnetic towards - the effect is off entirely.
  const magnetic = !reduced && !touch

  const handleEnter = () => {
    // Set the fast transition *before* the first offset is written, so the
    // button eases into the pull rather than jumping to it on the first sample.
    if (ref.current) ref.current.style.transition = PULL
  }

  const handleMove = (e: MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = clamp((e.clientX - rect.left - rect.width / 2) * STRENGTH, MAX_PULL)
    const y = clamp((e.clientY - rect.top - rect.height / 2) * STRENGTH, MAX_PULL)
    ref.current.style.transform = `translate(${x}px, ${y}px)`
  }

  const handleLeave = () => {
    if (!ref.current) return
    ref.current.style.transition = RELEASE
    ref.current.style.transform = ''
  }

  const base =
    'inline-flex items-center justify-center px-6 py-3 rounded-full text-sm font-medium transition-all duration-300'
  const variants = {
    primary:
      'bg-white text-slate-900 hover:bg-indigo-50 shadow-[0_0_24px_rgba(129,140,248,0.25)] hover:shadow-[0_0_32px_rgba(129,140,248,0.35)]',
    ghost:
      'bg-transparent text-slate-300 border border-white/15 hover:border-white/30 hover:text-white',
  }

  const classes = `${base} ${variants[variant]} ${className}`

  const magnetProps = magnetic
    ? {
        onMouseEnter: handleEnter,
        onMouseMove: handleMove,
        onMouseLeave: handleLeave,
      }
    : {}

  if (href) {
    return (
      <a
        ref={ref as React.RefObject<HTMLAnchorElement>}
        href={href}
        className={classes}
        {...magnetProps}
      >
        {children}
      </a>
    )
  }

  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      type={type}
      className={classes}
      onClick={onClick}
      {...magnetProps}
    >
      {children}
    </button>
  )
}
