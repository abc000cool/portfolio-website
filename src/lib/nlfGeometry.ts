import * as THREE from 'three'

/**
 * NASA/Langley NLF(1)-0416 natural-laminar-flow airfoil.
 * Coordinates digitized from the UIUC database (Somers, NASA TP-1861) —
 * the same data/airfoils/nlf416.dat used by the transition atlas pipeline.
 * Upper and lower surfaces run LE→TE in unit-chord space.
 */
export const NLF_0416_UPPER: [number, number][] = [
  [0.0, 0.0],
  [0.00049, 0.00403],
  [0.00509, 0.01446],
  [0.01393, 0.02573],
  [0.02687, 0.03729],
  [0.04383, 0.0487],
  [0.06471, 0.05964],
  [0.08936, 0.06984],
  [0.11761, 0.07904],
  [0.14925, 0.08707],
  [0.18404, 0.09374],
  [0.22169, 0.09892],
  [0.26187, 0.10247],
  [0.30422, 0.10425],
  [0.34839, 0.10405],
  [0.39438, 0.10162],
  [0.44227, 0.09729],
  [0.49172, 0.09166],
  [0.54204, 0.08515],
  [0.59256, 0.07801],
  [0.64262, 0.07047],
  [0.69155, 0.06272],
  [0.73872, 0.05493],
  [0.7835, 0.04724],
  [0.8253, 0.03977],
  [0.86357, 0.03265],
  [0.89779, 0.02594],
  [0.92749, 0.01974],
  [0.95224, 0.014],
  [0.97197, 0.00862],
  [0.98686, 0.00398],
  [0.99656, 0.00098],
  [1.0, 0.0],
]

export const NLF_0416_LOWER: [number, number][] = [
  [0.0, 0.0],
  [0.00073, -0.00439],
  [0.00709, -0.01154],
  [0.01956, -0.01883],
  [0.03708, -0.02594],
  [0.05933, -0.03254],
  [0.08609, -0.03847],
  [0.11708, -0.04361],
  [0.152, -0.04787],
  [0.1905, -0.05121],
  [0.23218, -0.05357],
  [0.27659, -0.05494],
  [0.32326, -0.05529],
  [0.37167, -0.05462],
  [0.42127, -0.05291],
  [0.4715, -0.05009],
  [0.52175, -0.04614],
  [0.57122, -0.04063],
  [0.62019, -0.0325],
  [0.67014, -0.02231],
  [0.72107, -0.01221],
  [0.77156, -0.00364],
  [0.82012, 0.00278],
  [0.86536, 0.00667],
  [0.90576, 0.00792],
  [0.93978, 0.00696],
  [0.96638, 0.00478],
  [0.9852, 0.00242],
  [0.99633, 0.00065],
  [1.0, 0.0],
]

export const NLF_CHORD = 3.2
/** Vertical centering offset in unit-chord space (max upper + min lower)/2. */
const NLF_Y_CENTER = (0.10425 - 0.05529) / 2

/** Unit-chord x/c → world X (chord centered on origin). */
export function xcToWorld(xc: number, chord = NLF_CHORD): number {
  return (xc - 0.5) * chord
}

/** Unit-chord y/c → world Y. */
export function ycToWorld(yc: number, chord = NLF_CHORD): number {
  return (yc - NLF_Y_CENTER) * chord
}

function interpolateSurface(points: [number, number][], xc: number): number {
  if (xc <= points[0][0]) return points[0][1]
  const last = points[points.length - 1]
  if (xc >= last[0]) return last[1]
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i]
    if (xc <= x1) {
      const [x0, y0] = points[i - 1]
      const t = (xc - x0) / (x1 - x0 || 1)
      return y0 + (y1 - y0) * t
    }
  }
  return last[1]
}

/** Upper-surface y/c at a given x/c. */
export function nlfUpperY(xc: number): number {
  return interpolateSurface(NLF_0416_UPPER, xc)
}

/** Lower-surface y/c at a given x/c. */
export function nlfLowerY(xc: number): number {
  return interpolateSurface(NLF_0416_LOWER, xc)
}

/** Closed profile loop in world coords: upper LE→TE, lower TE→LE. */
export function nlfProfileWorld(chord = NLF_CHORD): Float32Array {
  const loop: [number, number][] = [...NLF_0416_UPPER]
  for (let i = NLF_0416_LOWER.length - 2; i >= 0; i--) {
    loop.push(NLF_0416_LOWER[i])
  }
  const out = new Float32Array(loop.length * 2)
  loop.forEach(([x, y], i) => {
    out[i * 2] = xcToWorld(x, chord)
    out[i * 2 + 1] = ycToWorld(y, chord)
  })
  return out
}

/** Extruded wing-section geometry, span along Z, centered on origin. */
export function buildNlfWingGeometry(span: number, chord = NLF_CHORD): THREE.BufferGeometry {
  const profile = nlfProfileWorld(chord)
  const shape = new THREE.Shape()
  shape.moveTo(profile[0], profile[1])
  for (let i = 1; i < profile.length / 2; i++) {
    shape.lineTo(profile[i * 2], profile[i * 2 + 1])
  }
  shape.closePath()

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: span,
    bevelEnabled: false,
    curveSegments: 48,
    steps: 1,
  })
  geometry.translate(0, 0, -span / 2)
  geometry.computeVertexNormals()
  return geometry
}

/*
 * Transition-front model for the atlas viewer, grounded in the published
 * dataset (Re = 4×10⁶, α = 4°): median ∂x_tr/∂N_crit ≈ 0.011–0.014c per unit,
 * ∂C_d/∂N_crit ≈ −1.2 counts per unit, envelope bias +0.010–0.035c aft of the
 * full-spectrum Orr–Sommerfeld front.
 */
export const NCRIT_MIN = 5
export const NCRIT_MAX = 13

/** Upper-surface envelope-eN transition location x_tr/c. */
export function xtrUpper(ncrit: number): number {
  return 0.3 + 0.013 * (ncrit - NCRIT_MIN)
}

/** Lower-surface transition location x_tr/c (longer laminar run). */
export function xtrLower(ncrit: number): number {
  return 0.52 + 0.009 * (ncrit - NCRIT_MIN)
}

/** Section drag in counts (1 count = 1e-4) as the laminar run shortens. */
export function dragCounts(ncrit: number): number {
  return 80 - 1.2 * (ncrit - NCRIT_MIN)
}

/** Envelope-vs-Orr–Sommerfeld bias in x/c (envelope runs aft). */
export function envelopeBias(ncrit: number): number {
  return 0.01 + 0.0031 * (ncrit - NCRIT_MIN)
}
