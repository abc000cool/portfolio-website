import * as THREE from 'three'

export interface AirfoilProfile {
  id: string
  label: string
  /** Closed loop: upper surface LE→TE, then lower TE→LE. Chord on X, thickness on Y. */
  points: Float32Array
  cl: number
  cd: number
  aoa: number
}

const PROFILE_RESOLUTION = 128
/** World-space chord length — thickness preserves real t/c ratio. */
const CHORD_LENGTH = 3.2
const SPAN_DEPTH = 0.14

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

function cosineSpacing(n: number): number[] {
  const xs: number[] = []
  for (let i = 0; i < n; i++) {
    const beta = (i / (n - 1)) * Math.PI
    xs.push((1 - Math.cos(beta)) / 2)
  }
  return xs
}

function thicknessDistribution(x: number, t: number): number {
  return (
    5 *
    t *
    (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1015 * x ** 4)
  )
}

function camberLine(x: number, m: number, p: number): { yc: number; dyc: number } {
  if (m <= 0 || p <= 0) return { yc: 0, dyc: 0 }
  if (x < p) {
    const yc = (m / p ** 2) * (2 * p * x - x ** 2)
    const dyc = (2 * m / p ** 2) * (p - x)
    return { yc, dyc }
  }
  const yc = (m / (1 - p) ** 2) * ((1 - 2 * p) + 2 * p * x - x ** 2)
  const dyc = (2 * m / (1 - p) ** 2) * (p - x)
  return { yc, dyc }
}

/** Build NACA 4-digit coordinates in unit chord space (x: 0→1). */
function naca4Unit(m: number, p: number, t: number, resolution = PROFILE_RESOLUTION): Float32Array {
  const half = Math.floor(resolution / 2)
  const xs = cosineSpacing(half + 1)
  const upper: [number, number][] = []
  const lower: [number, number][] = []

  for (const x of xs) {
    const yt = thicknessDistribution(x, t)
    const { yc, dyc } = camberLine(x, m, p)
    const theta = Math.atan(dyc)
    const xu = x - yt * Math.sin(theta)
    const yu = yc + yt * Math.cos(theta)
    const xl = x + yt * Math.sin(theta)
    const yl = yc - yt * Math.cos(theta)
    upper.push([xu, yu])
    lower.push([xl, yl])
  }

  const points: [number, number][] = [...upper]
  for (let i = lower.length - 2; i >= 0; i--) {
    points.push(lower[i])
  }
  return flattenPoints(points)
}

function flattenPoints(points: [number, number][]): Float32Array {
  const out = new Float32Array(points.length * 2)
  points.forEach(([x, y], i) => {
    out[i * 2] = x
    out[i * 2 + 1] = y
  })
  return out
}

/**
 * Scale to world chord while preserving thickness-to-chord ratio.
 * Profile is centered on origin with chord along X.
 */
function toWorldCoords(unitPoints: Float32Array, chord = CHORD_LENGTH): Float32Array {
  const count = unitPoints.length / 2
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < count; i++) {
    const x = unitPoints[i * 2]
    const y = unitPoints[i * 2 + 1]
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const chordLen = maxX - minX || 1
  const scale = chord / chordLen
  const out = new Float32Array(unitPoints.length)
  for (let i = 0; i < count; i++) {
    out[i * 2] = (unitPoints[i * 2] - cx) * scale
    out[i * 2 + 1] = (unitPoints[i * 2 + 1] - cy) * scale
  }
  return out
}

export function naca4Profile(m: number, p: number, t: number, resolution = PROFILE_RESOLUTION): Float32Array {
  return toWorldCoords(naca4Unit(m, p, t, resolution))
}

export function bluntBodyProfile(resolution = PROFILE_RESOLUTION): Float32Array {
  const points: [number, number][] = []
  const n = resolution
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const angle = Math.PI * t
    const x = 0.5 - 0.5 * Math.cos(angle)
    const bluntness = 0.18 + 0.06 * Math.sin(angle)
    const y = bluntness * Math.sin(angle)
    points.push([x, y])
  }
  return toWorldCoords(flattenPoints(points), 2.8)
}

export function streamlineProfile(resolution = PROFILE_RESOLUTION): Float32Array {
  const points: [number, number][] = []
  const n = resolution
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const angle = Math.PI * t
    const x = 0.5 - 0.5 * Math.cos(angle)
    const thickness =
      0.14 *
      Math.sin(angle) *
      (1 + 0.35 * Math.sin(angle)) *
      (1 - 0.15 * Math.cos(2 * Math.PI * x))
    points.push([x, thickness])
  }
  return toWorldCoords(flattenPoints(points), 3.0)
}

export function optimizedMorphProfile(resolution = PROFILE_RESOLUTION): Float32Array {
  const unit = naca4Unit(0.024, 0.42, 0.11, resolution)
  const morphed = new Float32Array(unit.length)
  const count = unit.length / 2
  for (let i = 0; i < count; i++) {
    const x = unit[i * 2]
    const y = unit[i * 2 + 1]
    const upper = y >= 0.02
    const leFactor = Math.exp(-((x - 0) ** 2) / 0.012)
    const teFactor = Math.exp(-((x - 1) ** 2) / 0.02)
    const camberBoost = upper ? 0.018 * teFactor : -0.006 * teFactor
    const leRefine = upper ? 0.012 * leFactor : -0.008 * leFactor
    morphed[i * 2] = x
    morphed[i * 2 + 1] = y * 0.94 + camberBoost + leRefine
  }
  return toWorldCoords(morphed)
}

export const RESEARCH_AIRFOIL_PROFILES: AirfoilProfile[] = [
  {
    id: 'blunt-body',
    label: 'Blunt Reentry Profile',
    points: bluntBodyProfile(),
    cl: 0.12,
    cd: 0.42,
    aoa: 0,
  },
  {
    id: 'streamline',
    label: 'Streamlined Body',
    points: streamlineProfile(),
    cl: 0.28,
    cd: 0.18,
    aoa: 2,
  },
  {
    id: 'naca-2412',
    label: 'NACA 2412 Baseline',
    points: naca4Profile(0.02, 0.4, 0.12),
    cl: 0.82,
    cd: 0.028,
    aoa: 4,
  },
  {
    id: 'optimized-morph',
    label: 'Optimized Morph',
    points: optimizedMorphProfile(),
    cl: 1.12,
    cd: 0.019,
    aoa: 5,
  },
]

export const FEATURED_AIRFOIL_PROFILES: AirfoilProfile[] = [
  RESEARCH_AIRFOIL_PROFILES[2],
  RESEARCH_AIRFOIL_PROFILES[3],
]

export interface MorphState {
  fromIndex: number
  toIndex: number
  t: number
  activeIndex: number
  profile: AirfoilProfile
  morphedPoints: Float32Array
  cl: number
  cd: number
  aoa: number
  profileCount: number
}

export function getMorphState(
  scrollProgress: number,
  profiles: AirfoilProfile[] = RESEARCH_AIRFOIL_PROFILES,
): MorphState {
  const profileCount = profiles.length
  const clamped = Math.max(0, Math.min(1, scrollProgress))
  const scaled = clamped * (profileCount - 1)
  const fromIndex = Math.min(profileCount - 2, Math.floor(scaled))
  const toIndex = fromIndex + 1
  const t = smoothstep(scaled - fromIndex)

  const from = profiles[fromIndex]
  const to = profiles[toIndex]
  const morphedPoints = morphProfiles(from.points, to.points, t)
  const activeIndex = t < 0.5 ? fromIndex : toIndex
  const profile = t < 0.5 ? from : to

  return {
    fromIndex,
    toIndex,
    t,
    activeIndex,
    profile,
    morphedPoints,
    cl: from.cl + (to.cl - from.cl) * t,
    cd: from.cd + (to.cd - from.cd) * t,
    aoa: from.aoa + (to.aoa - from.aoa) * t,
    profileCount,
  }
}

export function morphProfiles(a: Float32Array, b: Float32Array, t: number): Float32Array {
  const count = Math.min(a.length, b.length) / 2
  const out = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) {
    out[i * 2] = a[i * 2] + (b[i * 2] - a[i * 2]) * t
    out[i * 2 + 1] = a[i * 2 + 1] + (b[i * 2 + 1] - a[i * 2 + 1]) * t
  }
  return out
}

export function pseudoCp(x: number, y: number, cl: number): number {
  const upper = y >= 0
  const le = Math.exp(-((x + CHORD_LENGTH * 0.5) ** 2) / 0.45)
  const suction = upper ? -0.8 * (1 - Math.abs(x) * 0.12) - cl * 0.15 : 0.4 * (1 - Math.abs(x) * 0.08)
  return suction + le * (upper ? -0.5 : 0.3)
}

export function cpToColor(cp: number): THREE.Color {
  const color = new THREE.Color()
  if (cp < 0) {
    color.setRGB(0.2 + -cp * 0.35, 0.45 + -cp * 0.25, 0.95)
  } else {
    color.setRGB(0.95, 0.55 + cp * 0.2, 0.2 + cp * 0.15)
  }
  return color
}

/**
 * Thin wing section: profile in XY (chord × thickness), span along Z.
 * Camera should face the cross-section (look along ±Z).
 */
export function buildAirfoilSolidGeometry(
  profilePoints: Float32Array,
  span = SPAN_DEPTH,
  cl = 0.5,
): THREE.BufferGeometry {
  const count = profilePoints.length / 2
  const shape = new THREE.Shape()
  shape.moveTo(profilePoints[0], profilePoints[1])
  for (let i = 1; i < count; i++) {
    shape.lineTo(profilePoints[i * 2], profilePoints[i * 2 + 1])
  }
  shape.closePath()

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: span,
    bevelEnabled: false,
    curveSegments: 64,
    steps: 1,
  })

  geometry.translate(0, 0, -span / 2)

  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const c = cpToColor(pseudoCp(x, y, cl))
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

/** Edge highlight along the cross-section profile at mid-span. */
export function buildProfileLinePoints(profilePoints: Float32Array, z = 0): Float32Array {
  const count = profilePoints.length / 2
  const line = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    line[i * 3] = profilePoints[i * 2]
    line[i * 3 + 1] = profilePoints[i * 2 + 1]
    line[i * 3 + 2] = z
  }
  return line
}

/** @deprecated Use buildAirfoilSolidGeometry */
export const buildExtrudedAirfoilGeometry = buildAirfoilSolidGeometry

export { CHORD_LENGTH, SPAN_DEPTH, smoothstep }
