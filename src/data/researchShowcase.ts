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
  /** Sticky scroll zone height â€” higher = longer animation. Unused when viewer is omitted. */
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
    scrollHeightVh: 150,
    linkTo: '/projects/sweep',
    linkLabel: 'Explore SWEEP project â†’',
    viewerHint: 'Scroll to run debris survey â†’ capture â†’ ejection sequence',
    conferenceBadge: {
      conference: 'AAS',
      number: '248',
      location: 'Pasadena, California',
    },
    metrics: [
      { value: 'US Patent', label: 'SWEEP platform design' },
      { value: '3', label: 'Railguns â€” ejection doubles as thrust' },
      { value: '0', label: 'Traditional propellant used to maneuver' },
    ],
  },
  {
    id: 'research-airfoil',
    paperSlug: 'morphing-airfoil-qaoa',
    viewer: 'airfoil',
    scrollHeightVh: 150,
    linkTo: '/research/morphing-airfoil-qaoa',
    linkLabel: 'Read full abstract â†’',
    viewerHint: 'Scroll to morph NACA 2412 baseline â†’ QAOA-optimized profile',
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
    scrollHeightVh: 150,
    linkTo: '/projects/flowstate',
    linkLabel: 'Explore FlowState project â†’',
    viewerHint: 'Scroll to dissipate congestion waves through the corridor',
    metrics: [
      { value: '42%', label: 'Published jam-reduction benchmark targeted' },
      { value: '5.2', label: 'km/h flow-speed gain Â· published benchmark' },
      { value: 'CFD', label: 'Navierâ€“Stokes traffic modeling' },
    ],
  },
  {
    id: 'research-qcin',
    paperSlug: 'hybrid-quantum-classical-inertial-navigation',
    viewer: 'qcin',
    scrollHeightVh: 150,
    linkTo: '/research/hybrid-quantum-classical-inertial-navigation',
    linkLabel: 'Read full abstract â†’',
    viewerHint: 'Scroll: atom interferometer â†’ hybrid bias lock',
    externalUrl: 'https://qcin-nav.vercel.app/',
    githubUrl: 'https://github.com/abc000cool/qcin-nav',
    metrics: [
      { value: '27,648', label: 'Sobolâ€² simulations' },
      { value: '4.9Ã—', label: 'Tighter Â· 5-min GNSS jamming' },
      { value: '313Ã—', label: 'Tighter Â· 5-day cislunar coast' },
      { value: '8/8', label: 'Validation tests passed' },
    ],
  },
  {
    id: 'research-sailnko',
    paperSlug: 'solar-sail-displaced-nko',
    viewer: 'sailnko',
    scrollHeightVh: 150,
    linkTo: '/research/solar-sail-displaced-nko',
    linkLabel: 'Read full abstract â†’',
    viewerHint: 'Scroll: deploy the sail â†’ lift the ring above the ecliptic â†’ optical envelope',
    externalUrl: 'https://solar-sail-nko.vercel.app/',
    githubUrl: 'https://github.com/abc000cool/solar-sail-nko-site',
    metrics: [
      { value: '55.5Â°', label: 'Thrust-cone ceiling Â· optical model' },
      { value: 'Ã—1.23', label: 'Median lightness penalty vs ideal' },
      { value: '750', label: 'Converged minimum-time transfers' },
      { value: '0.36â€“0.39 yr', label: 'Time to envelope Â· 5â€“150 g/mÂ²' },
    ],
  },
  {
    id: 'research-transition',
    paperSlug: 'nlf-transition-atlas',
    viewer: 'transition',
    scrollHeightVh: 150,
    linkTo: '/research/nlf-transition-atlas',
    linkLabel: 'Read full abstract â†’',
    viewerHint: 'Scroll to sweep Ncrit â€” the transition front moves, then meets the 1981 data',
    externalUrl: 'https://transition-atlas.vercel.app/',
    githubUrl: 'https://github.com/abc000cool/nlf-transition-atlas',
    metrics: [
      { value: '7,020', label: 'Polar points Â· 96.2% converged' },
      { value: '0.011c', label: 'Median âˆ‚xtr/âˆ‚Ncrit shift' },
      { value: '+0.010â€“0.035c', label: 'Envelope bias vs Orrâ€“Sommerfeld' },
      { value: '0.023c RMS', label: 'Validation vs 1981 Langley data' },
    ],
  },
]

export function getResearchShowcasePaper(slug: string): Paper | undefined {
  return portfolio.papers.find((p) => p.slug === slug)
}
