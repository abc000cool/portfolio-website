import type { Paper } from './portfolio'
import { portfolio } from './portfolio'

export interface ResearchMetric {
  value: string
  label: string
}

export interface ConferenceBadge {
  conference: string
  number: string
  location: string
}

export type ResearchViewerId =
  | 'debris'
  | 'airfoil'
  | 'flowstate'
  | 'qcin'
  | 'sailnko'
  | 'transition'

export interface ResearchShowcaseConfig {
  id: string
  paperSlug: string
  /** Omit for card-only research (no 3D scroll viewer yet). */
  viewer?: ResearchViewerId
  /** Sticky scroll zone height — higher = longer animation. Unused when viewer is omitted. */
  scrollHeightVh?: number
  linkTo: string
  linkLabel: string
  viewerHint?: string
  metrics: ResearchMetric[]
  conferenceBadge?: ConferenceBadge
  /** Flip card/viewer columns on desktop. */
  reverseLayout?: boolean
  externalUrl?: string
  githubUrl?: string
}

export const RESEARCH_SHOWCASE: ResearchShowcaseConfig[] = [
  {
    id: 'research-debris',
    paperSlug: 'space-debris-mitigation',
    viewer: 'debris',
    scrollHeightVh: 300,
    linkTo: '/projects/sweep',
    linkLabel: 'Explore SWEEP project →',
    viewerHint: 'Scroll to run debris survey → capture → ejection sequence',
    conferenceBadge: {
      conference: 'AAS',
      number: '248',
      location: 'Pasadena, California',
    },
    metrics: [
      { value: 'US Patent', label: 'SWEEP platform design' },
      { value: 'LEO', label: 'Low-Earth orbit targeting' },
      { value: 'EM', label: 'Electromagnetic ejection propulsion' },
    ],
  },
  {
    id: 'research-airfoil',
    paperSlug: 'morphing-airfoil-qaoa',
    viewer: 'airfoil',
    scrollHeightVh: 400,
    linkTo: '/research/morphing-airfoil-qaoa',
    linkLabel: 'Read full abstract →',
    viewerHint: 'Scroll to morph NACA 2412 baseline → QAOA-optimized profile',
    metrics: [
      { value: '9.3%', label: 'Drag reduction vs NACA 2412' },
      { value: '37%', label: 'Lift improvement' },
      { value: 'QAOA', label: 'Discrete sampling at p=2' },
    ],
    reverseLayout: true,
  },
  {
    id: 'research-flowstate',
    paperSlug: 'traffic-fluid-dynamics',
    viewer: 'flowstate',
    scrollHeightVh: 300,
    linkTo: '/projects/flowstate',
    linkLabel: 'Explore FlowState project →',
    viewerHint: 'Scroll to dissipate congestion waves through the corridor',
    metrics: [
      { value: '42%', label: 'Jam reduction at 5% AV penetration' },
      { value: '5.2', label: 'km/h average flow speed gain' },
      { value: 'CFD', label: 'Navier–Stokes traffic modeling' },
    ],
  },
  {
    id: 'research-qcin',
    paperSlug: 'hybrid-quantum-classical-inertial-navigation',
    viewer: 'qcin',
    scrollHeightVh: 320,
    linkTo: '/research/hybrid-quantum-classical-inertial-navigation',
    linkLabel: 'Read full abstract →',
    viewerHint: 'Scroll: atom interferometer → hybrid bias lock',
    externalUrl: 'https://qcin-nav.vercel.app/',
    githubUrl: 'https://github.com/abc000cool/qcin-nav',
    metrics: [
      { value: '27,648', label: 'Sobol′ simulations' },
      { value: '4.9×', label: 'Tighter · 5-min GNSS jamming' },
      { value: '313×', label: 'Tighter · 5-day cislunar coast' },
      { value: '8/8', label: 'Validation tests passed' },
    ],
  },
  {
    id: 'research-sailnko',
    paperSlug: 'solar-sail-displaced-nko',
    viewer: 'sailnko',
    scrollHeightVh: 400,
    linkTo: '/research/solar-sail-displaced-nko',
    linkLabel: 'Read full abstract →',
    viewerHint: 'Scroll: deploy the sail → lift the ring above the ecliptic → optical envelope',
    externalUrl: 'https://solar-sail-nko.vercel.app/',
    githubUrl: 'https://github.com/abc000cool/solar-sail-nko-site',
    metrics: [
      { value: '55.5°', label: 'Thrust-cone ceiling · optical model' },
      { value: '×1.23', label: 'Median lightness penalty vs ideal' },
      { value: '750', label: 'Converged minimum-time transfers' },
      { value: '0.36–0.39 yr', label: 'Time to envelope · 5–150 g/m²' },
    ],
  },
  {
    id: 'research-transition',
    paperSlug: 'nlf-transition-atlas',
    viewer: 'transition',
    scrollHeightVh: 420,
    linkTo: '/research/nlf-transition-atlas',
    linkLabel: 'Read full abstract →',
    viewerHint: 'Scroll to sweep Ncrit — the transition front moves, then meets the 1981 data',
    externalUrl: 'https://transition-atlas.vercel.app/',
    githubUrl: 'https://github.com/abc000cool/nlf-transition-atlas',
    metrics: [
      { value: '7,020', label: 'Polar points · 96.2% converged' },
      { value: '0.011c', label: 'Median ∂xtr/∂Ncrit shift' },
      { value: '+0.010–0.035c', label: 'Envelope bias vs Orr–Sommerfeld' },
      { value: '0.023c RMS', label: 'Validation vs 1981 Langley data' },
    ],
  },
]

export function getResearchShowcasePaper(slug: string): Paper | undefined {
  return portfolio.papers.find((p) => p.slug === slug)
}
