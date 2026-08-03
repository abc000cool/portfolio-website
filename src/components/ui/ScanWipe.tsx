import { type ReactNode } from 'react'
import { motion } from 'motion/react'
import { useLightExperience } from '../../hooks/useTouchDevice'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import {
  EARLY_VIEWPORT,
  revealHidden,
  revealTransition,
  revealVisible,
} from '../../lib/revealMotion'

interface ScanWipeProps {
  children: ReactNode
  /** When provided, reveal is driven externally instead of viewport. */
  active?: boolean
  className?: string
  delay?: number
}

/**
 * The workhorse body reveal - a flat lift-and-fade, used by every content
 * block. It is deliberately the quiet one: RedactedHeading carries the
 * emphasis, and this runs underneath it without competing.
 *
 * There is no `filter: blur()` here and there must not be one. These blocks sit
 * directly above live WebGL canvases, and animating a blur over a compositing
 * surface is the single most expensive thing you can ask a browser to do on the
 * exact frames those canvases are starting up. Opacity and translate only.
 */
export function ScanWipe(props: ScanWipeProps) {
  const { children, className = '', delay = 0.1, active } = props
  const light = useLightExperience()
  const reduced = useReducedMotion()

  const hidden = revealHidden(light)
  const visible = revealVisible(light)

  // MotionConfig's reducedMotion="user" only suppresses transforms - it lets
  // opacity keep animating, so a reader who asked for no motion still got a
  // half-second fade on every block on the page. A reveal is decoration; under
  // reduced motion it resolves to its final state with nothing animating at
  // all. Rendered as a plain element so there is no transition to inherit.
  if (reduced) {
    return <div className={className}>{children}</div>
  }

  const reveal =
    active !== undefined
      ? { animate: active ? visible : hidden }
      : { whileInView: visible, viewport: EARLY_VIEWPORT }

  return (
    <motion.div
      className={className}
      initial={hidden}
      {...reveal}
      transition={revealTransition(delay)}
    >
      {children}
    </motion.div>
  )
}
