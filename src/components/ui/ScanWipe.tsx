import { type ReactNode } from 'react'
import { motion } from 'motion/react'
import { useLightExperience } from '../../hooks/useTouchDevice'
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
 */
export function ScanWipe(props: ScanWipeProps) {
  const { children, className = '', delay = 0.1, active } = props
  const light = useLightExperience()

  const hidden = revealHidden(light)
  const visible = revealVisible(light)

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
