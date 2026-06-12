import { type ReactNode } from 'react'
import { motion } from 'motion/react'

interface ScanWipeProps {
  children: ReactNode
  /** When provided, reveal is driven externally (mission waypoint arrival) instead of viewport. */
  active?: boolean
  className?: string
  delay?: number
}

const hidden = { opacity: 0, y: 32, filter: 'blur(8px)' }
const visible = { opacity: 1, y: 0, filter: 'blur(0px)' }

export function ScanWipe(props: ScanWipeProps) {
  const { children, className = '', delay = 0.1, active } = props

  const reveal =
    active !== undefined
      ? { animate: active ? visible : hidden }
      : { whileInView: visible, viewport: { once: true, margin: '-15% 0px' } }

  return (
    <motion.div
      className={className}
      initial={hidden}
      {...reveal}
      transition={{ duration: 0.85, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
