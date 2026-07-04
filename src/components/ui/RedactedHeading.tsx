import { motion } from 'motion/react'
import { useLightExperience } from '../../hooks/useTouchDevice'
import { EARLY_VIEWPORT, revealHidden, revealVisible } from '../../lib/revealMotion'

interface RedactedHeadingProps {
  children: string
  as?: 'h2' | 'h3'
  className?: string
  /** When provided, reveal is driven externally instead of viewport. */
  active?: boolean
}

export function RedactedHeading(props: RedactedHeadingProps) {
  const { children, as: Tag = 'h2', className = '', active } = props
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
      transition={{ duration: light ? 0.55 : 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      <Tag className="section-heading">{children}</Tag>
    </motion.div>
  )
}
