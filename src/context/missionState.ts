import { createContext, useContext } from 'react'

/**
 * Values half of the mission context.
 *
 * This lives apart from `MissionContext.tsx` on purpose: React Fast Refresh can
 * only preserve state for a module whose exports are *all* components, so the
 * provider component and these hooks/contexts cannot share a file. Anything that
 * is not a component belongs here; `MissionContext.tsx` exports the provider and
 * nothing else.
 */

export interface MissionCheckpoint {
  id: string
  /** Normalized arc-length progress (0–1) where this waypoint sits on the flight path. */
  at: number
}

export interface MissionState {
  /** Sticky — once the rocket reaches a waypoint, it stays reached. */
  reached: Record<string, boolean>
  /** Current mission phase (last waypoint crossed); follows scroll in both directions. */
  phase: string
}

export interface MissionUpdater {
  update: (progress: number, checkpoints: MissionCheckpoint[]) => void
  markAllReached: (checkpoints: MissionCheckpoint[]) => void
}

/** Reveal slightly before exact arrival so headings near a section top aren't blank. */
export const REVEAL_EPSILON = 0.04
export const PHASE_EPSILON = 0.015

export const MissionStateContext = createContext<MissionState>({ reached: {}, phase: 'intro' })
export const MissionUpdaterContext = createContext<MissionUpdater>({
  update: () => {},
  markAllReached: () => {},
})

export function useMissionState(): MissionState {
  return useContext(MissionStateContext)
}

export function useWaypointReached(id: string): boolean {
  return useContext(MissionStateContext).reached[id] === true
}

export function useMissionUpdater(): MissionUpdater {
  return useContext(MissionUpdaterContext)
}
