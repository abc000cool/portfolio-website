/** Shared reveal viewport - triggers before content reaches the fold. */
export const EARLY_VIEWPORT = { once: true, margin: '0px 0px 40% 0px' } as const

/**
 * Body tier. Every paragraph, card and content block on the site runs on this.
 *
 * It is deliberately the quicker of the two tiers: a block that is still
 * arriving after the reader has started on it reads as lag, not as motion. The
 * heading tier below is what carries emphasis, so body copy only has to get out
 * of its own way.
 */
export const REVEAL_DURATION = 0.42

/**
 * Ease-out for arrivals: most of the distance is covered immediately, then a
 * long settle. No overshoot - this site is full of instruments and gauges, and
 * bounce on a readout reads as sloppy rather than playful.
 */
export const REVEAL_EASE = [0.22, 1, 0.36, 1] as const

/**
 * Heading tier. Slower than body copy and paired with a different *kind* of
 * motion (RedactedHeading's scan wipe), which is where the hierarchy actually
 * comes from - a section title should not just be a paragraph that took longer.
 */
export const HEADING_DURATION = 0.58

/**
 * Softer than REVEAL_EASE. A travelling scan line eased on a near-expo curve
 * spends most of its life parked at the far end, so it never reads as a sweep.
 * This is a plain ease-out cubic: quick off the mark, still visibly moving
 * through the middle of the beat.
 */
export const HEADING_EASE = [0.33, 1, 0.68, 1] as const

/**
 * The default reveal: opacity and translate only, deliberately blur-free.
 *
 * This same reveal wraps six live WebGL canvases. A CSS `filter: blur()` on an
 * element containing a canvas forces the whole subtree through an offscreen
 * composite - and it was doing so on exactly the frames those canvases start
 * rendering. Translate and opacity stay on the compositor.
 *
 * The travel is short on purpose. Long lifts on large blocks draw the eye to
 * the block's edge rather than its content, and with a dozen of them on a page
 * the site reads as one continuous slide.
 */
export const revealHidden = (light: boolean) => ({ opacity: 0, y: light ? 8 : 12 })

const SETTLED = { opacity: 1, y: 0 }

/**
 * Settled state. Identical for both experiences - it takes `light` so a call
 * site can pair it with `revealHidden(light)` without branching, and so the two
 * always agree on which properties animate.
 */
export const revealVisible = (light: boolean) => {
  void light
  return SETTLED
}

/** Transition shared by every body reveal. */
export const revealTransition = (delay = 0) => ({
  duration: REVEAL_DURATION,
  delay,
  ease: REVEAL_EASE,
})

/**
 * Transition for the heading tier. Same shape as `revealTransition` so the two
 * are drop-in interchangeable at a call site.
 */
export const headingTransition = (delay = 0) => ({
  duration: HEADING_DURATION,
  delay,
  ease: HEADING_EASE,
})

/**
 * Gap between consecutive items in a staggered group. Small enough that a row
 * of cards still reads as one arrival rather than a queue.
 */
export const REVEAL_STAGGER = 0.06
