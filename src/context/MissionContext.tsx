import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  MissionStateContext,
  MissionUpdaterContext,
  PHASE_EPSILON,
  REVEAL_EPSILON,
  type MissionCheckpoint,
  type MissionState,
} from './missionState'

/**
 * Exports the provider and nothing else - the contexts, hooks and types live in
 * `./missionState` so Fast Refresh can keep this module's state across edits.
 */
export function MissionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MissionState>({ reached: {}, phase: 'intro' })

  const update = useCallback((progress: number, checkpoints: MissionCheckpoint[]) => {
    setState((prev) => {
      let phase = checkpoints[0]?.id ?? prev.phase
      let reached = prev.reached
      let changed = false

      for (const cp of checkpoints) {
        if (progress >= cp.at - PHASE_EPSILON) phase = cp.id
        if (progress >= cp.at - REVEAL_EPSILON && !prev.reached[cp.id]) {
          if (reached === prev.reached) reached = { ...prev.reached }
          reached[cp.id] = true
          changed = true
        }
      }

      if (phase !== prev.phase) changed = true
      return changed ? { reached, phase } : prev
    })
  }, [])

  const markAllReached = useCallback((checkpoints: MissionCheckpoint[]) => {
    setState((prev) => {
      if (checkpoints.every((cp) => prev.reached[cp.id])) return prev
      const reached = { ...prev.reached }
      checkpoints.forEach((cp) => {
        reached[cp.id] = true
      })
      return { reached, phase: prev.phase }
    })
  }, [])

  const updater = useMemo(() => ({ update, markAllReached }), [update, markAllReached])

  return (
    <MissionUpdaterContext.Provider value={updater}>
      <MissionStateContext.Provider value={state}>{children}</MissionStateContext.Provider>
    </MissionUpdaterContext.Provider>
  )
}
