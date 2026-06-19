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

export type ResearchViewerId = 'debris' | 'airfoil' | 'flowstate'

export interface ResearchShowcaseConfig {
  id: string
  paperSlug: string
  viewer: ResearchViewerId
  /** Sticky scroll zone height — higher = longer animation. */
  scrollHeightVh: number
  linkTo: string
  linkLabel: string
  viewerHint: string
  metrics: ResearchMetric[]
  conferenceBadge?: ConferenceBadge
  /** Flip card/viewer columns on desktop. */
  reverseLayout?: boolean
}

export const RESEARCH_SHOWCASE: ResearchShowcaseConfig[] = [
  {
    id: 'research-debris',
    paperSlug: 'space-debris-mitigation',
    viewer: 'debris',
    scrollHeightVh: 240,
    linkTo: '/research/space-debris-mitigation',
    linkLabel: 'Read full abstract →',
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
    scrollHeightVh: 240,
    linkTo: '/projects/flowstate',
    linkLabel: 'Explore FlowState project →',
    viewerHint: 'Scroll to dissipate congestion waves through the corridor',
    metrics: [
      { value: '42%', label: 'Jam reduction at 5% AV penetration' },
      { value: '5.2', label: 'km/h average flow speed gain' },
      { value: 'CFD', label: 'Navier–Stokes traffic modeling' },
    ],
  },
]

export function getResearchShowcasePaper(slug: string): Paper | undefined {
  return portfolio.papers.find((p) => p.slug === slug)
}
