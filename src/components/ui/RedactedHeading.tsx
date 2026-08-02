import { motion } from 'motion/react'
import { useLightExperience } from '../../hooks/useTouchDevice'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { EARLY_VIEWPORT, REVEAL_EASE } from '../../lib/revealMotion'

interface RedactedHeadingProps {
  children: string
  as?: 'h2' | 'h3'
  className?: string
  /** When provided, reveal is driven externally instead of viewport. */
  active?: boolean
}

/**
 * The one emphatic reveal on the site, and the only motion reserved for
 * headings: the text is uncovered left-to-right by a travelling scan line —
 * the motion the component has always been named for. Everything else on the
 * page uses the flat ScanWipe fade, so a section heading is now the loudest
 * thing that happens when a section arrives.
 *
 * Cheap by construction: a clip-path inset plus one transformed 2px bar. No
 * filters, nothing that forces a repaint of the text itself.
 */
const CLIPPED = { clipPath: 'inset(0% 100% 0% 0%)' }
const OPEN = { clipPath: 'inset(0% 0% 0% 0%)' }
const WIPE_DURATION = 0.55

export function RedactedHeading(props: RedactedHeadingProps) {
  const { children, as: Tag = 'h2', className = '', active } = props
  const light = useLightExperience()
  const reduced = useReducedMotion()

  // clip-path is neither a transform nor an opacity, so MotionConfig's
  // reducedMotion="user" would happily keep animating it. Opt out here instead.
  if (reduced) {
    return (
      <div className={className}>
        <Tag className="section-heading">{children}</Tag>
      </div>
    )
  }

  const wipe =
    active !== undefined
      ? { animate: active ? OPEN : CLIPPED }
      : { whileInView: OPEN, viewport: EARLY_VIEWPORT }

  const scan =
    active !== undefined
      ? {
          animate: active
            ? { x: '0%', opacity: [0, 1, 1, 0] }
            : { x: '-100%', opacity: 0 },
        }
      : {
          whileInView: { x: '0%', opacity: [0, 1, 1, 0] },
          viewport: EARLY_VIEWPORT,
        }

  return (
    <div className={`relative ${className}`}>
      <motion.div initial={CLIPPED} {...wipe} transition={{ duration: WIPE_DURATION, ease: REVEAL_EASE }}>
        <Tag className="section-heading">{children}</Tag>
      </motion.div>

      {!light && (
        // Full-width carrier so a percentage translate sweeps the bar across
        // the heading; the bar itself rides its right edge.
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-full"
          initial={{ x: '-100%', opacity: 0 }}
          {...scan}
          transition={{ duration: WIPE_DURATION, ease: 'linear' }}
        >
          <span className="absolute inset-y-0 right-0 w-[2px] bg-[#c7d2fe] shadow-[0_0_12px_2px_rgba(129,140,248,0.5)]" />
        </motion.span>
      )}
    </div>
  )
}
