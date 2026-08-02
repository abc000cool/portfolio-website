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

/* ------------------------------------------------------------------ *
 * Flight-path rail geometry
 *
 * The flight path used to weave across the full width of the document,
 * which put the stroke through the hero headline, through body copy, and
 * parked the rocket in the middle of a paragraph. It now runs as a rail
 * in the left gutter — outside the centred content column at every
 * viewport width — so it can be a navigation spine instead of garnish.
 * ------------------------------------------------------------------ */

/** Widest the centred content column ever gets (`.section-inner` in global.css). */
const CONTENT_MAX_WIDTH = 1140
/** Keep the rail at least this far from the viewport edge. */
const RAIL_EDGE = 14
/** Keep an unlabelled rail at least this far from the content column. */
const RAIL_CLEAR = 12
/** Widest serpentine band — beyond this the rail stops reading as a single line. */
const RAIL_MAX_WIDTH = 40
/** Gap between the rail's outer edge and a label chip. */
const LABEL_GAP = 8
/** Keep a label chip this far off the content column. */
const LABEL_CLEAR = 6
/** Rendered width of the widest chip — "Projects"/"Research", 8 chars. See labelChipWidth(). */
const LABEL_MAX_CHIP = 73
/** Narrowest serpentine worth keeping in exchange for persistent labels. */
const RAIL_MIN_LABELLED = 6
/** Below this much free gutter, waypoint hit targets would steal taps from content. */
const MIN_INTERACTIVE_GUTTER = 44

/** Advance per character of the 11px mono label, including letter-spacing. */
const LABEL_CHAR = 7.05
/** Chip padding, both sides. */
const LABEL_PAD = 8

/** Width of the chip behind a waypoint label. */
export function labelChipWidth(label: string): number {
  return Math.round(Math.max(48, label.length * LABEL_CHAR + LABEL_PAD * 2))
}

export interface RailGeometry {
  /** Inner (left-most) x of the rail band. */
  left: number
  /** x of the rail's centre line — where `center` waypoints sit. */
  centre: number
  /** Half the rail band's width; `left`/`right` waypoints sit ±this from centre. */
  amplitude: number
  /** Free space between the viewport edge and the content column. */
  gutter: number
  /** x where a waypoint label chip starts. */
  labelX: number
  /** Left padding inside a label chip. */
  labelPad: number
  /** True when the gutter can hold a persistent label chip without covering content. */
  labelsFit: boolean
  /** True when there is room for hit targets that will not steal taps from content. */
  interactive: boolean
  /** Radius of the invisible waypoint hit target. 0 when not interactive. */
  hitRadius: number
}

/**
 * Everything the flight path needs to lay itself out at a given container
 * width. Pure arithmetic — safe to call per waypoint during a measure pass.
 */
export function railGeometry(width: number): RailGeometry {
  // Mirrors `.section-shell` padding: clamp(1.5rem, 5vw, 4rem).
  const pad = Math.min(64, Math.max(24, width * 0.05))
  const column = Math.min(CONTENT_MAX_WIDTH, Math.max(280, width - pad * 2))
  const gutter = Math.max(0, (width - column) / 2)

  // Labels get first claim on the gutter: the serpentine narrows — to a nearly
  // straight spine if it has to — in exchange for every stop being named. Once
  // the gutter is too tight for a chip at all, the rail takes the whole band
  // back. Either way it stops short of the content column.
  const railForLabel = gutter - RAIL_EDGE - LABEL_GAP - LABEL_MAX_CHIP - LABEL_CLEAR
  const labelsFit = railForLabel >= RAIL_MIN_LABELLED
  const railWidth = labelsFit
    ? Math.min(RAIL_MAX_WIDTH, railForLabel)
    : Math.min(RAIL_MAX_WIDTH, Math.max(0, gutter - RAIL_EDGE - RAIL_CLEAR))

  const amplitude = railWidth / 2
  const centre = RAIL_EDGE + amplitude
  const interactive = gutter >= MIN_INTERACTIVE_GUTTER

  return {
    left: RAIL_EDGE,
    centre,
    amplitude,
    gutter,
    labelX: RAIL_EDGE + railWidth + LABEL_GAP,
    labelPad: LABEL_PAD,
    labelsFit,
    interactive,
    hitRadius: interactive ? Math.min(22, Math.max(14, gutter - centre - 4)) : 0,
  }
}

export function waypointX(side: WaypointSide, width: number): number {
  const { centre, amplitude } = railGeometry(width)
  switch (side) {
    case 'left':
      return centre - amplitude
    case 'right':
      return centre + amplitude
    default:
      return centre
  }
}
