/** Shared reveal viewport — triggers before content reaches the fold. */
export const EARLY_VIEWPORT = { once: true, margin: '0px 0px 40% 0px' } as const

export const revealHidden = (light: boolean) =>
  light ? { opacity: 0, y: 20 } : { opacity: 0, y: 36, filter: 'blur(10px)' }

export const revealVisible = (light: boolean) =>
  light ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, filter: 'blur(0px)' }
