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
  | 'nozzlemoc'
  | 'eilj2'
  | 'bli'
  | 'rde'

export interface ResearchShowcaseConfig {
  id: string
  paperSlug: string
  /** Omit for card-only research (no 3D scroll viewer yet). */
  viewer?: ResearchViewerId
  /** Sticky scroll zone height - higher = longer animation. Unused when viewer is omitted. */
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
    scrollHeightVh: 180,
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
      { value: '3', label: 'Railguns - ejection doubles as thrust' },
      { value: '0', label: 'Traditional propellant used to maneuver' },
    ],
  },
  {
    id: 'research-airfoil',
    paperSlug: 'morphing-airfoil-qaoa',
    viewer: 'airfoil',
    scrollHeightVh: 220,
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
    scrollHeightVh: 180,
    linkTo: '/projects/flowstate',
    linkLabel: 'Explore FlowState project →',
    viewerHint: 'Scroll to dissipate congestion waves through the corridor',
    metrics: [
      { value: '42%', label: 'Published jam-reduction benchmark targeted' },
      { value: '5.2', label: 'km/h flow-speed gain · published benchmark' },
      { value: 'CFD', label: 'Navier–Stokes traffic modeling' },
    ],
  },
  {
    id: 'research-qcin',
    paperSlug: 'hybrid-quantum-classical-inertial-navigation',
    viewer: 'qcin',
    scrollHeightVh: 190,
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
    scrollHeightVh: 220,
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
    scrollHeightVh: 230,
    linkTo: '/research/nlf-transition-atlas',
    linkLabel: 'Read full abstract →',
    viewerHint: 'Scroll to sweep Ncrit - the transition front moves, then meets the 1981 data',
    externalUrl: 'https://transition-atlas.vercel.app/',
    githubUrl: 'https://github.com/abc000cool/nlf-transition-atlas',
    metrics: [
      { value: '7,020', label: 'Polar points · 96.2% converged' },
      { value: '0.011c', label: 'Median ∂xtr/∂Ncrit shift' },
      { value: '+0.010–0.035c', label: 'Envelope bias vs Orr–Sommerfeld' },
      { value: '0.023c RMS', label: 'Validation vs 1981 Langley data' },
    ],
  },
  {
    id: 'research-nozzlemoc',
    paperSlug: 'nozzlemoc',
    viewer: 'nozzlemoc',
    scrollHeightVh: 200,
    linkTo: '/research/nozzlemoc',
    linkLabel: 'Read full abstract →',
    viewerHint: 'Scroll: the bell draws itself in → characteristic mesh sweeps the interior',
    externalUrl: 'https://nozzlemoc-website.vercel.app',
    githubUrl: 'https://github.com/abc000cool/nozzlemoc',
    metrics: [
      { value: '0.011%', label: 'Agreement with the textbook benchmark' },
      { value: '0.550', label: 'Universal turning ratio discovered' },
      { value: '1952', label: 'NACA Mach-10 nozzle reproduced' },
      { value: '8,192', label: 'Coupled simulations · sensitivity analysis' },
    ],
  },
  {
    id: 'research-eilj2',
    paperSlug: 'estimation-in-the-loop-j2',
    viewer: 'eilj2',
    scrollHeightVh: 210,
    linkTo: '/research/estimation-in-the-loop-j2',
    linkLabel: 'Read full abstract →',
    viewerHint: 'Scroll: J2 drift → the filter lies → the trade inverts → the fix',
    externalUrl: 'https://when-the-filter-lies.vercel.app',
    githubUrl: 'https://github.com/abc000cool/resonance-j2-eil',
    metrics: [
      { value: '45,860', label: 'Closed-loop Monte-Carlo simulations' },
      { value: 'Inverted', label: 'Mistuned filter flips the sensor-fuel trade' },
      { value: 'cm-class', label: 'GPS priced against delta-V once fixed' },
    ],
  },
  {
    id: 'research-bli',
    paperSlug: 'bli-power-balance',
    viewer: 'bli',
    scrollHeightVh: 200,
    linkTo: '/research/bli-power-balance',
    linkLabel: 'Read full abstract →',
    viewerHint: 'Scroll: the boundary layer feeds the fan → 147,456 runs → the error bars',
    externalUrl: 'https://bli-benefit-site.vercel.app',
    githubUrl: 'https://github.com/abc000cool/bli-power-balance',
    metrics: [
      { value: '147,456', label: 'Monte-Carlo + Sobol evaluations' },
      { value: '0.3–3.7%', label: 'Fuel saved · 90% confidence' },
      { value: '55%', label: 'Ingestion at the interior optimum' },
      { value: '2–12%', label: 'Spread of published claims unified' },
    ],
  },
  {
    id: 'research-rde',
    paperSlug: 'rde-wave-count-atlas',
    viewer: 'rde',
    scrollHeightVh: 220,
    linkTo: '/research/rde-wave-count-atlas',
    linkLabel: 'Read full abstract →',
    viewerHint: 'Scroll: one wave splits into four → the ring unrolls → the atlas resolves',
    externalUrl: 'https://rde-wave-count-atlas.vercel.app',
    githubUrl: 'https://github.com/abc000cool/rde-wave-atlas',
    metrics: [
      { value: '5,856', label: 'GPU simulations · first regime map' },
      { value: '6', label: 'Laboratories in the validation set' },
      { value: '19 / 24', label: 'Experimental points within one wave' },
      { value: '8–10%', label: 'Below Chapman–Jouguet wave speed' },
    ],
  },
]

export function getResearchShowcasePaper(slug: string): Paper | undefined {
  return portfolio.papers.find((p) => p.slug === slug)
}
