/** Shared reveal viewport - triggers before content reaches the fold. */
export const EARLY_VIEWPORT = { once: true, margin: '0px 0px 40% 0px' } as const

/**
 * One duration for every body reveal on the site. The old 0.85s made each
 * block feel like it was still arriving after the reader had started on it.
 */
export const REVEAL_DURATION = 0.5

export const REVEAL_EASE = [0.22, 1, 0.36, 1] as const

/**
 * The default reveal: opacity and translate only, deliberately blur-free.
 *
 * This same reveal wraps six live WebGL canvases. A CSS `filter: blur()` on an
 * element containing a canvas forces the whole subtree through an offscreen
 * composite - and it was doing so on exactly the frames those canvases start
 * rendering. Translate and opacity stay on the compositor.
 */
export const revealHidden = (light: boolean) => ({ opacity: 0, y: light ? 14 : 20 })

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
