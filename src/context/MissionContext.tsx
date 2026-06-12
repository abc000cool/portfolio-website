import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export interface MissionCheckpoint {
  id: string
  /** Normalized arc-length progress (0–1) where this waypoint sits on the flight path. */
  at: number
}

interface MissionState {
  /** Sticky — once the rocket reaches a waypoint, it stays reached. */
  reached: Record<string, boolean>
  /** Current mission phase (last waypoint crossed); follows scroll in both directions. */
  phase: string
}

interface MissionUpdater {
  update: (progress: number, checkpoints: MissionCheckpoint[]) => void
  markAllReached: (checkpoints: MissionCheckpoint[]) => void
}

/** Reveal slightly before exact arrival so headings near a section top aren't blank. */
const REVEAL_EPSILON = 0.04
const PHASE_EPSILON = 0.015

const MissionStateContext = createContext<MissionState>({ reached: {}, phase: 'intro' })
const MissionUpdaterContext = createContext<MissionUpdater>({
  update: () => {},
  markAllReached: () => {},
})

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

export function useMissionState(): MissionState {
  return useContext(MissionStateContext)
}

export function useWaypointReached(id: string): boolean {
  return useContext(MissionStateContext).reached[id] === true
}

export function useMissionUpdater(): MissionUpdater {
  return useContext(MissionUpdaterContext)
}
