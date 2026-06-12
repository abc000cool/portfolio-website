import { motion } from 'motion/react'

interface RedactedHeadingProps {
  children: string
  as?: 'h2' | 'h3'
  className?: string
  /** When provided, reveal is driven externally (mission waypoint arrival) instead of viewport. */
  active?: boolean
}

const hidden = { opacity: 0, y: 36, filter: 'blur(10px)' }
const visible = { opacity: 1, y: 0, filter: 'blur(0px)' }

export function RedactedHeading(props: RedactedHeadingProps) {
  const { children, as: Tag = 'h2', className = '', active } = props

  const reveal =
    active !== undefined
      ? { animate: active ? visible : hidden }
      : { whileInView: visible, viewport: { once: true, margin: '-12% 0px' } }

  return (
    <motion.div
      className={className}
      initial={hidden}
      {...reveal}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      <Tag className="section-heading">{children}</Tag>
    </motion.div>
  )
}
