export interface ProjectSpec {
  label: string
  value: string
}

export interface ProjectSection {
  title: string
  description: string
  items?: string[]
  status?: string
}

export interface ProjectDoc {
  title: string
  description: string
  url?: string
}

export type ProjectGroup = 'selected' | 'other'

export interface ProjectPage {
  slug: string
  title: string
  subtitle?: string
  status?: string
  category: string
  tagline: string
  overview: string
  group?: ProjectGroup
  externalUrl?: string
  specs?: ProjectSpec[]
  sections: ProjectSection[]
  capabilities?: { title: string; items: string[] }[]
  documentation?: ProjectDoc[]
  tags: string[]
  patchColors: [string, string, string]
}

export const projectPages: ProjectPage[] = [
  {
    slug: 'stratos',
    title: 'STRATOS',
    subtitle: 'Simulation of Thrust, Rate-of-climb, Aerodynamics, and Total Operating States',
    status: 'Completed',
    category: 'ISM Original Work',
    tagline: 'High-Fidelity Aircraft Performance & Envelope Simulation Environment',
    overview:
      'STRATOS is a physics-based flight performance simulator intended for preliminary aerospace engineering analysis. This custom-built computational tool models the performance of subsonic aircraft using first-principles aerodynamic and propulsion equations. Real use cases include engineers testing whether proposed aircraft configurations can meet predetermined mission requirements. The simulator outputs plots and key metrics on flight performance, validated against real-world aircraft data with 1.5% accuracy on Boeing 737-800 stall speed calculations.',
    specs: [
      { label: 'Aircraft Category', value: 'Subsonic' },
      { label: 'Modeling Approach', value: 'First-Principles' },
      { label: 'Atmosphere Model', value: 'ISA Standard' },
      { label: 'Drag Model', value: 'Parabolic Polar' },
      { label: 'Propulsion Types', value: 'Jet / Propeller' },
      { label: 'Altitude Range', value: '0 – 15 km' },
    ],
    sections: [
      {
        title: 'ACES — Atmospheric Condition & Standard Earth Systems',
        status: 'Complete',
        description:
          'The foundation of the simulator. Computes atmospheric properties as a function of altitude using the International Standard Atmosphere (ISA). Models temperature, pressure, and density from sea level through the troposphere (up to 15 km), covering the operational envelope of most subsonic aircraft.',
      },
      {
        title: 'RLM — Raw Logistic Modulator',
        status: 'Complete',
        description:
          'Serves as a liaison between input aircraft values and core physics-based calculations. Takes raw input data (geometry, weight, propulsion, aerodynamic coefficients) and converts them into standardized, numeric variables, preventing physically impossible scenarios.',
      },
      {
        title: 'OSC — Optimal Statistics Calculator',
        status: 'Complete',
        description:
          'Extracts meaningful performance metrics from raw numerical outputs. Delivers performance curves, contour plots, and critical metric values including minimum thrust required, maximum level flight speed, and optimal climb rates.',
      },
      {
        title: 'RS — Report Summarizer',
        status: 'Complete',
        description:
          'Synthesizes all raw data and statistics into written/visual format for end users. Powered by an AI Language Model for near-instantaneous reports once simulation completes.',
      },
    ],
    capabilities: [
      {
        title: 'Performance Analysis',
        items: [
          'Maximum and cruise speed determination',
          'Rate of climb calculations',
          'Service and absolute ceiling computation',
          'Power required vs. power available curves',
        ],
      },
      {
        title: 'Range & Endurance',
        items: [
          'Breguet range equation implementation',
          'Maximum range speed optimization',
          'Fuel consumption analysis',
        ],
      },
      {
        title: 'Aerodynamic Analysis',
        items: [
          'Drag polar generation',
          'Lift-to-drag ratio optimization',
          'Oswald efficiency factor modeling',
        ],
      },
      {
        title: 'Mission Simulation',
        items: [
          'Multi-segment mission profiles',
          'Takeoff and landing performance',
          'Configuration feasibility validation',
        ],
      },
    ],
    externalUrl: 'https://stratos-sim.us/',
    documentation: [
      {
        title: 'Original Work Proposal',
        description: 'Detailed project proposal outlining objectives, methodology, and timeline.',
        url: 'https://blobs.vusercontent.net/blob/Ansh_Pathak_OWP_1.6.25-vEcaCb872uCqgY1fTqKwVCup9j3ddp.pdf',
      },
      {
        title: 'Progress Update #1',
        description: 'Current state of development, completed modules, and next steps.',
        url: 'https://blobs.vusercontent.net/blob/Ansh_Pathak_OWPA1_2.18.2026%20%281%29-wQGRC6ivdBkkwkf3OmPufyK95HhQVz.pdf',
      },
    ],
    tags: ['Flight Mechanics', 'Python', 'ISA Model', 'First-Principles'],
    patchColors: ['#1a2744', '#818cf8', '#4a7cff'],
  },
  {
    slug: 'propulsion-studio',
    title: 'Propulsion Studio',
    status: 'Completed',
    category: 'Aerospace Design Platform',
    tagline: 'Interactive engineering workstation for aerospace propulsion systems',
    overview:
      'An interactive engineering workstation for designing and analyzing aerospace propulsion systems. Users can select from 9+ propulsion families, assemble modular components, and instantly analyze system performance with live physics-based feedback. The platform provides real-time calculations for thrust, specific impulse, efficiency, mass estimates, and thermal load.',
    sections: [
      {
        title: 'Modular assembly',
        description:
          'Auto-layout and drag-and-drop assembly make the platform both professional and intuitive for aerospace systems engineering. Users build architectures visually while the engine computes performance in real time.',
      },
      {
        title: 'Mission evaluation',
        description:
          'Propellant and environment presets, mission suitability evaluation, and design comparison with architecture diagrams help validate concepts before detailed design.',
      },
      {
        title: 'Export & reporting',
        description:
          'Export capabilities include JSON, PNG, and PDF so designs and analysis can be shared with teams or embedded in reports.',
      },
    ],
    externalUrl: 'https://abc000cool.github.io/propulsion-studio/',
    tags: ['Propulsion Systems', 'Systems Engineering', 'Live Analysis', 'Design Optimization'],
    patchColors: ['#0f1624', '#e8a317', '#b8bfca'],
  },
  {
    slug: 'sweep',
    title: 'SWEEP',
    subtitle: 'Space Waste Electromagnetic Ejection Platform',
    status: 'US Patent Holder',
    category: 'US Patent Holder Design',
    tagline: 'Autonomous space debris capture and ejection using electromagnetic propulsion',
    overview:
      "SWEEP (Space Waste Electromagnetic Ejection Platform) is a US Patent Holder spacecraft design addressing space debris proliferation in Earth's orbit. The system combines autonomous algorithms, debris processing, electromagnetic railgun propulsion, and gyroscopic control to capture debris, compact it into pellets, and eject it from orbit — using recoil thrust to maneuver between targets without expending traditional propellant.",
    externalUrl: 'https://sweep-feff1.web.app/',
    sections: [
      {
        title: 'Autonomous algorithm',
        description:
          'An autonomous decision-making loop maps debris targets, intercepts objects, and selects railguns to reorient the capture tunnel for the next debris encounter.',
      },
      {
        title: 'Debris processing',
        description:
          'Captured debris is encapsulated in a conductive medium, transported to a compression chamber, and compacted into dense pellets for ejection.',
      },
      {
        title: 'Electromagnetic propulsion & disposal',
        description:
          'Pellets are fired from one of three railguns toward deep space using electromagnetic acceleration, removing debris from Earth orbit while generating recoil thrust to maneuver SWEEP.',
      },
      {
        title: 'Attitude control',
        description:
          'Control Moment Gyroscopes (CMGs) orient the tunnel when approaching debris and stabilize the platform after each ejection without using fuel.',
      },
    ],
    tags: ['Space Propulsion', 'Orbital Mechanics', 'US Patent Holder', 'Spacecraft Design'],
    patchColors: ['#2a1a44', '#ff4d4d', '#e8a317'],
  },
  {
    slug: 'flowstate',
    title: 'FlowState',
    subtitle: 'Traffic Optimization Through Fluid Dynamics',
    status: 'Completed',
    category: 'IGSI Research Initiative',
    tagline: 'Traffic optimization through fluid dynamics',
    overview:
      'FlowState applies principles of fluid mechanics to simulate traffic patterns and deliver optimal driving recommendations that dissipate congestion faster. The platform models traffic as fluid flow using computational fluid dynamics and Navier-Stokes-based approaches to predict congestion waves in real time. Adaptive speed guidance helps drivers collectively reduce stop-and-go patterns, improve average flow speeds, and lower fuel consumption per platoon—with research indicating substantial jam reduction at modest connected-vehicle penetration.',
    externalUrl: 'https://flowstatetraffic.us/',
    sections: [
      {
        title: 'Fluid dynamics modeling',
        description:
          'Traffic behaves like fluid flow. Navier-Stokes equations and computational fluid dynamics model vehicle movement patterns to identify bottlenecks and predict congestion propagation with high fidelity.',
      },
      {
        title: 'Real-time simulation',
        description:
          'The simulation engine processes traffic data in milliseconds, predicting congestion patterns and calculating optimal speed recommendations before jams fully form.',
      },
      {
        title: 'Adaptive speed guidance',
        description:
          'Personalized speed recommendations create wave dissipation effects when adopted collectively, resolving traffic faster than passive routing alone.',
      },
      {
        title: 'Platform integration',
        description:
          'Designed for integration with major navigation platforms and fleet systems, enabling deployment without new roadside hardware.',
      },
    ],
    capabilities: [
      {
        title: 'Documented impact',
        items: [
          '42% jam reduction with JAD at 5% autonomous-vehicle penetration',
          '5.2 km/h average speed improvement in traffic flow',
          '5% AV penetration cited as minimum threshold for measurable impact',
          '20% fuel savings per platoon through smoother flow',
        ],
      },
      {
        title: 'Core capabilities',
        items: [
          'Reduces stop-and-go traffic patterns',
          'Minimizes fuel consumption and emissions',
          'Improves overall road capacity',
          'Works with existing infrastructure',
          'Scales to metropolitan areas',
        ],
      },
    ],
    tags: ['Fluid Dynamics', 'Traffic Engineering', 'Simulation', 'Optimization'],
    patchColors: ['#0f1a2e', '#38bdf8', '#6366f1'],
  },
  {
    slug: 'the-resonance-foundation',
    group: 'other',
    title: 'The Resonance Foundation',
    status: 'Active',
    category: '501(c)(3) Nonprofit',
    tagline: 'Making music education accessible across DFW',
    overview:
      'Founded a 501(c)(3) nonprofit committed to making music education accessible. Reached thousands of individuals across DFW with performances and events that bring music instruction and community engagement to families who might not otherwise have access.',
    sections: [
      {
        title: 'Community impact',
        description:
          'Organized performances and outreach events across the Dallas–Fort Worth area, connecting students and families with music education resources.',
      },
      {
        title: 'Leadership',
        description:
          'Built and led a registered nonprofit from the ground up — handling programming, events, and the organizational work required to sustain a 501(c)(3).',
      },
    ],
    externalUrl: 'https://www.theresonancefoundation.org/',
    tags: ['Nonprofit', 'Leadership', 'Community'],
    patchColors: ['#1a2744', '#3dff8a', '#c9a962'],
  },
  {
    slug: 'data-science-libraries',
    title: 'Data Science Libraries',
    status: 'Completed',
    group: 'other',
    category: 'Open Source',
    tagline: 'R libraries for Quarto-based data-science education',
    overview:
      'Developed and maintained R libraries used internationally on Quarto-based templates, enabling students to grasp data-science fundamentals through reproducible, accessible coursework materials.',
    sections: [
      {
        title: 'Open-source tooling',
        description:
          'Libraries designed for classroom and self-study contexts, lowering the barrier to reproducible analysis workflows.',
      },
      {
        title: 'International adoption',
        description:
          'Templates built on these libraries are used internationally, helping students learn core data-science concepts in a consistent Quarto environment.',
      },
    ],
    externalUrl: 'https://github.com/PPBDS',
    tags: ['R', 'Data Science', 'Open Source'],
    patchColors: ['#0f1624', '#6366f1', '#3dff8a'],
  },
]

const SLUG_ALIASES: Record<string, string> = {
  'space-debris-solution': 'sweep',
}

export function getProjectBySlug(slug: string): ProjectPage | undefined {
  const resolved = SLUG_ALIASES[slug] ?? slug
  return projectPages.find((p) => p.slug === resolved)
}

export function resolveProjectSlug(slug: string): string {
  return SLUG_ALIASES[slug] ?? slug
}

export function getProjectsByGroup(group: ProjectGroup): ProjectPage[] {
  return projectPages.filter((p) => (p.group ?? 'selected') === group)
}
