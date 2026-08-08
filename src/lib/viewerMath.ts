import * as THREE from 'three'

/**
 * Shared scrub math for the research viewers added after the first six.
 * The originals each carry private copies of these; new viewers import from
 * here instead so each scene file stays focused on its geometry.
 */

/**
 * Longest frame step any smoother should honour. Canvases run
 * frameloop="demand" off screen, so the first delta after a wake is the whole
 * wall-clock gap; clamping keeps that frame from snapping eased values onto
 * their targets or teleporting particles.
 */
export const MAX_DELTA = 0.05

/** Normalized position of `value` inside [start, end], clamped to 0..1. */
export function range01(value: number, start: number, end: number): number {
  if (end <= start) return value >= end ? 1 : 0
  return THREE.MathUtils.clamp((value - start) / (end - start), 0, 1)
}

/**
 * Frame-rate independent exponential approach.
 * `dt` must already be clamped by the caller.
 */
export function approach(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt))
}

/** Deterministic pseudo-random in [0, 1) - stable across frames for a seed. */
export function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
