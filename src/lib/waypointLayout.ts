import type { SectionId } from '../data/portfolio'

export type WaypointSide = 'left' | 'center' | 'right'

export const SECTION_WAYPOINT_SIDES: Record<SectionId, WaypointSide> = {
  intro: 'center',
  hero: 'right',
  about: 'left',
  projects: 'right',
  research: 'left',
  ism: 'center',
  stats: 'right',
  contact: 'center',
}

/**
 * Section layout class. On wide screens, content shifts subtly toward the
 * section's flight-path waypoint side (see SECTION_WAYPOINT_SIDES).
 */
export function sectionShellClass(side?: WaypointSide): string {
  if (side === 'left') return 'section-shell shell-left'
  if (side === 'right') return 'section-shell shell-right'
  return 'section-shell'
}

export function waypointX(side: WaypointSide, width: number): number {
  switch (side) {
    case 'left':
      return width * 0.1
    case 'right':
      return width * 0.9
    default:
      return width * 0.5
  }
}
