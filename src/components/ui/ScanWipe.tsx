import { type ReactNode } from 'react'
import { motion } from 'motion/react'
import { useLightExperience } from '../../hooks/useTouchDevice'
import { EARLY_VIEWPORT, revealHidden, revealVisible } from '../../lib/revealMotion'

interface ScanWipeProps {
  children: ReactNode
  /** When provided, reveal is driven externally instead of viewport. */
  active?: boolean
  className?: string
  delay?: number
}

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
      transition={{ duration: light ? 0.5 : 0.85, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
