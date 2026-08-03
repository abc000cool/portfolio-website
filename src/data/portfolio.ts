export interface SocialLink {
  label: string
  url: string
}

import { projectPages, type ProjectGroup, type ProjectSpec } from './projectPages'

export interface Project {
  id: string
  slug: string
  title: string
  patchColors: [string, string, string]
  description: string
  tags: string[]
  details: string
  status?: string
  externalUrl?: string
  githubUrl?: string
  group?: ProjectGroup
  /** Surfaced on the project card's hover/focus readout. */
  category?: string
  specs?: ProjectSpec[]
}

export interface Paper {
  id: string
  slug: string
  title: string
  venue: string
  year: number
  abstract: string
  /** Short plain-language summary for card/list surfaces (the full abstract stays on the detail page). */
  summary?: string
  /** Optional HTML for subscripts/superscripts in abstracts. */
  abstractHtml?: string
  externalUrl?: string
  githubUrl?: string
}

export interface Stat {
  label: string
  value?: number
  suffix?: string
  /** Text shown instead of animated odometer (for non-numeric stats). */
  display?: string
  /** Skip count-up animation and show final value immediately. */
  static?: boolean
}

export interface Award {
  id: string
  category: string
  title: string
  description: string
}

export interface Experience {
  id: string
  role: string
  organization: string
  period: string
  type: string
  description: string
}

export const portfolio = {
  identity: {
    name: 'Ansh Pathak',
    title: 'Aerospace research · US patent',
    tagline:
      'US patent holder for SWEEP, a space-debris capture platform presented at AAS 248. Six papers and preprints, and a flight simulator validated to 1.5% against a Boeing 737-800.',
    school: 'Heritage High School',
    location: 'Frisco, TX',
    email: 'pathakansh10@gmail.com',
    portrait: '/ansh-pathak.png',
    socials: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/in/ansh-pathak1/' },
      { label: 'GitHub', url: 'https://github.com/abc000cool' },
      { label: 'Email', url: 'mailto:pathakansh10@gmail.com' },
    ] as SocialLink[],
    quote: {
      text: 'What we do in life, echoes in eternity',
      attribution: 'Maximus Decimus Meridius',
    },
  },
  about: {
    bio: 'I am a driven and adept senior at Heritage High School with a strong passion for STEM fields, especially aerospace engineering and quantum mechanics. Backed by 7+ years of programming and engineering experience and a demonstrated ability to solve complex problems and create innovative solutions, I actively seek opportunities to pursue professional development, innovate, lead, and apply my skills in real-world projects through hands-on work, rigor, and impactful collaborations.',
    missionStatement:
      'Through my independent study, I wish to litanize my pursuit of knowledge in the broader field of aerospace engineering, and in the specificity of flight mechanics. I want to start with flight mechanics and then observe applications to this field with either optimization or quantum applications. I will gain the skills and learn about the expertise needed to professionally contribute to the industry in my future career through my final project and mentorship.',
    highlights: [
      'US Patent Holder - developed SWEEP, a novel solution to space debris proliferation',
      'FIRST World Championship Qualifier - outstanding robotics contributions with Team 6369',
      'Quantum Computing Practicum - studied quantum algorithms with UT Dallas faculty',
      'Nonprofit Founder - founded The Resonance Foundation, a 501(c)(3) music education nonprofit',
    ],
  },
  projects: projectPages.map((p) => ({
    id: `proj-${p.slug}`,
    slug: p.slug,
    title: p.title,
    patchColors: p.patchColors,
    description: p.tagline,
    tags: p.tags,
    details: p.overview,
    status: p.status,
    externalUrl: p.externalUrl,
    githubUrl: p.githubUrl,
    group: p.group ?? 'selected',
    category: p.category,
    specs: p.specs,
  })) as Project[],
  papers: [
    {
      id: 'paper-debris',
      slug: 'space-debris-mitigation',
      title: 'Space Debris Mitigation',
      venue: 'AAS 248 - Pasadena, CA',
      year: 2026,
      summary:
        'SWEEP, a US-patented spacecraft that captures orbital debris, compacts it into dense pellets, and fires them out of orbit from electromagnetic railguns - using the recoil to maneuver. Presented at AAS 248.',
      abstract:
        "Research on novel approaches to address the growing problem of space debris in Earth's orbit, including spacecraft design and operational algorithms. This work explores active debris removal strategies, mission planning optimization, and the development of practical solutions for space sustainability.",
    },
    {
      id: 'paper-traffic',
      slug: 'traffic-fluid-dynamics',
      title: 'Traffic Optimization Through Fluid Dynamics',
      venue: 'Pending',
      year: 2026,
      summary:
        'Treats traffic as fluid flow, using Navier-Stokes modeling to find bottlenecks and predict congestion waves in real time, then issues adaptive speed guidance that dissipates them faster than passive routing.',
      abstract:
        'Applies principles of fluid mechanics to model traffic patterns and deliver driving recommendations that dissipate congestion faster. Traffic is treated as fluid flow using computational fluid dynamics and Navier-Stokes-based modeling to identify bottlenecks and predict congestion waves in real time. Adaptive speed guidance is calculated so collective driver behavior can reduce stop-and-go patterns, improve average flow speeds, and lower fuel consumption-with research indicating substantial jam reduction and meaningful speed improvements at modest connected-vehicle penetration rates.',
    },
    {
      id: 'paper-morphing-airfoil',
      slug: 'morphing-airfoil-qaoa',
      title:
        'Probabilistic Optimization of Continuous-Morphing Airfoil Geometries via Gaussian Process Surrogates and QAOA-Based Discrete Sampling',
      venue: 'Pending',
      year: 2026,
      summary:
        'Pairs Gaussian-process surrogate models with a quantum sampler (QAOA) to search morphing-airfoil shapes. The best design, checked in XFOIL, cut drag 9.3% and raised lift 37% over a NACA 2412 baseline.',
      abstract:
        'Continuously morphing airfoils reshape during flight to match changing aerodynamic conditions, enabling performance that fixed geometry designs fundamentally cannot achieve. We present a four-phase pipeline combining Gaussian Process surrogate modeling with QAOA as a diversity-oriented sampler for morphing airfoil optimization, validated against XFOIL with improved drag and lift over a NACA 2412 baseline.',
      abstractHtml:
        'Continuously morphing airfoils reshape during flight to match changing aerodynamic conditions, enabling performance that fixed geometry designs fundamentally cannot achieve. Optimizing them, however, means traversing high-dimensional, non-convex design spaces where classical gradient-based methods fail. We present a four-phase pipeline combining Gaussian Process (GP) surrogate modeling with the Quantum Approximate Optimization Algorithm (QAOA) as a diversity-oriented sampler for morphing airfoil optimization. We generated 1,500 airfoil geometries via B-spline parameterization and compressed them to a six-dimensional latent space using Principal Component Analysis (PCA). GP surrogates (drag C<sub>d</sub> and lift C<sub>l</sub>) were fit with a Matérn 5/2 kernel with Automatic Relevance Determination (ARD). The Upper Confidence Bound (UCB) acquisition landscape was projected onto a 24-qubit Quadratic Unconstrained Binary Optimization (QUBO) formulation via BOX-QUBO weighted regression, with a lift constraint (C<sub>l</sub>&ge;0.60) enforced as a decoupled post-sampling filter rather than a penalty term. QAOA at circuit depths p=1,2,3 was benchmarked against Simulated Annealing (SA), Genetic Algorithm (GA), and random search. Shannon entropy of the QAOA sampling distributions fell from H=2.342 at p=1 to H=2.216 at p=3, a 5.4% reduction confirming the QAOA cooling protocol hypothesis. QAOA at p=2 achieved the best constrained average drag (C<sub>d</sub>=0.00583) with all returned solutions satisfying the lift constraint. Decoupling the lift constraint from QUBO fitting improved model fit from R<sup>2</sup>=0.12 to R<sup>2</sup>=0.43. The best XFOIL-validated airfoil achieved a 9.3% drag reduction and 37% lift improvement over the NACA 2412 baseline at Re=10<sup>6</sup>.',
    },
    {
      id: 'paper-qcin',
      slug: 'hybrid-quantum-classical-inertial-navigation',
      title:
        'Which Error Sources Dominate Hybrid Quantum–Classical Inertial Navigation? A Sobol’ Variance Decomposition Across Atmospheric GNSS-Denied and Cislunar Regimes',
      venue: 'Computational Research Study',
      year: 2026,
      externalUrl: 'https://qcin-nav.vercel.app/',
      githubUrl: 'https://github.com/abc000cool/qcin-nav',
      summary:
        'An open-source simulator of a cold-atom and classical hybrid navigator. Across 27,648 runs it holds a median 7.6 m after five minutes of GNSS jamming - 4.9× tighter than classical-only - and shows which error sources dominate.',
      abstract:
        'A validated open-source simulator of a cold-atom interferometer + classical IMU hybrid navigator (Cheiney–Lautier–Wang architecture in a 15-state error-state EKF), paired with a global Sobol′ variance decomposition of its error budget across two opposite aerospace regimes: an atmospheric UAV under GNSS jamming, and a multi-day cislunar coast. Across 27,648 simulations and eight passing validation tests, the hybrid holds a median 7.6 m after five minutes of jamming (about 4.9× tighter than classical-only) and 124 km after a 4.98-day lunar coast versus 38,800 km unaided (313×). The study shows the remaining atmospheric error is dominated by gyroscope bias and platform vibration, while the cislunar floor is governed by classical accelerometer bias and coast duration-not cold-atom stability alone.',
      abstractHtml:
        'A validated open-source simulator of a cold-atom interferometer + classical IMU hybrid navigator (Cheiney–Lautier–Wang architecture in a 15-state error-state EKF), paired with a global Sobol′ variance decomposition of its error budget across two opposite aerospace regimes: an atmospheric UAV under GNSS jamming, and a multi-day cislunar coast. Across 27,648 simulations and eight passing validation tests, the hybrid holds a median <strong>7.6&nbsp;m</strong> after five minutes of jamming (~4.9× tighter than classical-only) and <strong>124&nbsp;km</strong> after a 4.98-day lunar coast versus 38,800&nbsp;km unaided (313×). Scenario&nbsp;A residual error is dominated by gyroscope bias (S<sub>T</sub>=0.48) and platform vibration (S<sub>T</sub>=0.46); Scenario&nbsp;B is governed by classical accelerometer bias (S<sub>T</sub>=0.56) and coast duration (S<sub>T</sub>=0.31), with CAI systematic bias contributing only S<sub>T</sub>=0.03. Dynamics use CR3BP targeting of a 3,250&nbsp;km Gateway NRHO perilune and are cross-checked against the DE440 ephemeris.',
    },
    {
      id: 'paper-sailnko',
      slug: 'solar-sail-displaced-nko',
      title:
        'The Joint Pareto Envelope of Heliocentric Circular Displaced Non-Keplerian Orbits Under the McInnes Optical Sail Force Model',
      venue: 'Preprint',
      year: 2026,
      externalUrl: 'https://solar-sail-nko.vercel.app/',
      githubUrl: 'https://github.com/abc000cool/solar-sail-nko-site',
      summary:
        'Maps which solar-sail orbits stay reachable once a realistic optical sail replaces the ideal reflector: required lightness rises a median 1.23×, and a 55.5° thrust-cone ceiling removes 4.9% of the Earth-synchronous family.',
      abstract:
        'Heliocentric displaced non-Keplerian orbits (NKOs) enable solar-observation, high-latitude Earth-observation, and space-weather mission concepts that no Keplerian orbit can access - but prior feasibility maps rely on an ideal reflector. This work computes the joint Pareto envelope of achievable displacement and minimum transfer time under the full six-coefficient McInnes optical force model, together with a controllability penalty map across the (ρ, z) parameter space. The optical model raises the required lightness number by a median factor of 1.23 relative to the ideal reflector, and its 55.5° thrust-cone ceiling removes 4.9% of the ideal-feasible territory of the Earth-synchronous family relevant to sub-L1 space-weather missions. Across two decades of sail loading (5–150 g/m²), the minimum time to reach the displacement envelope from a 1-au parking orbit is nearly invariant at 0.36–0.39 years. Built on an open-source pseudospectral optimal-control pipeline (CasADi + IPOPT) with 750 converged transfers at 100% solver convergence.',
      abstractHtml:
        'Heliocentric displaced non-Keplerian orbits (NKOs) enable solar-observation, high-latitude Earth-observation, and space-weather mission concepts that no Keplerian orbit can access - but prior feasibility maps, from McInnes (1998) through Bassetto and Quarta (2024), rely on an ideal cos<sup>2</sup>α reflector or reduced optical models. This work computes the <strong>joint Pareto envelope</strong> of achievable displacement and minimum transfer time under the full six-coefficient McInnes optical force model, together with a controllability penalty map that quantifies the linearised open-loop instability across the (ρ,&nbsp;z) parameter space. The optical model raises the required lightness number by a median factor of <strong>1.23</strong> relative to the ideal reflector for the minimum-lightness orbit family, and its thrust-cone ceiling of <strong>55.5°</strong> removes 4.9% of the ideal-feasible territory of the Earth-synchronous (Type&nbsp;III) family relevant to sub-L<sub>1</sub> space-weather missions. Across two decades of sail loading (5–150&nbsp;g&thinsp;m<sup>−2</sup>), the minimum time to reach the achievable displacement envelope from a 1-au parking orbit is nearly invariant at <strong>0.36–0.39 years</strong>. All results come from an open-source Python framework built on CasADi and IPOPT - 750 converged minimum-time transfers at 100% solver convergence, reproducing the Heiligers–McInnes Earth-following design point to 0.1%, with every converged trajectory re-propagated through an independent dynamics implementation.',
    },
    {
      id: 'paper-transition-atlas',
      slug: 'nlf-transition-atlas',
      title:
        'An Open Sensitivity Atlas of Envelope-eN Transition Prediction for Natural-Laminar-Flow Airfoils, with an Orr–Sommerfeld Cross-Check',
      venue: 'Preprint · Open dataset',
      year: 2026,
      externalUrl: 'https://transition-atlas.vercel.app/',
      githubUrl: 'https://github.com/abc000cool/nlf-transition-atlas',
      summary:
        'Sweeps 7,020 XFOIL solutions of a NASA laminar-flow airfoil to show how far the transition point moves with a single environment parameter, then validates against 1981 Langley wind-tunnel data to 0.023c RMS.',
      abstract:
        "Every prediction of a laminar-flow wing hinges on the transition point, and in XFOIL that point is set by a single environment parameter: Ncrit. This work sweeps the full general-aviation envelope of the NASA NLF(1)-0416 airfoil - 12 Reynolds numbers, 9 amplification thresholds, 65 angles of attack - and publishes the result as a queryable sensitivity atlas: 7,020 converged solutions (96.2%) with local derivatives, elasticities, Morris screening, and Sobol variance decomposition. A from-scratch Chebyshev-collocation Orr–Sommerfeld solver, verified against Orszag and Jordinson, integrates forty fixed-frequency amplification curves over XFOIL's own boundary layers and isolates the systematic bias of the envelope approximation: +0.010–0.035c aft in attached flow, about 2.2 Ncrit units of equivalent offset. Validation against a fully re-digitized set of 108 transition measurements from the original 1981 Langley wind-tunnel report closes the loop at 0.023c RMS - the measurement resolution - with 82% of predictions inside their orifice bracket.",
      abstractHtml:
        "Every prediction of a laminar-flow wing hinges on the transition point, and in XFOIL that point is set by a single environment parameter: N<sub>crit</sub>. This work sweeps the full general-aviation envelope of the NASA NLF(1)-0416 airfoil - 12 Reynolds numbers, 9 amplification thresholds, 65 angles of attack - and publishes the result as a queryable <strong>sensitivity atlas</strong>: 7,020 converged solutions (96.2%) with local derivatives (median ∂x<sub>tr</sub>/∂N<sub>crit</sub> ≈ 0.011c, ≈1.2 drag counts per unit), elasticities, Morris screening, and a 5,120-sample Sobol variance decomposition. A from-scratch Chebyshev-collocation <strong>Orr–Sommerfeld solver</strong>, verified against the classical results of Orszag and Jordinson, integrates forty fixed-frequency amplification curves over XFOIL's own boundary layers and isolates the systematic bias of the Drela–Giles envelope approximation: <strong>+0.010–0.035c aft</strong> in attached flow, ≈2.2 N<sub>crit</sub> units of equivalent offset. Validation against a fully re-digitized set of 108 transition measurements from the original 1981 Langley report (Somers, NASA TP-1861) closes the loop at <strong>0.023c RMS</strong> - the measurement resolution - with 82% of predictions inside their microphone-orifice bracket. Code MIT, data CC-BY, solvers checksummed.",
    },
  ] as Paper[],
  stats: [
    { label: 'US patent - SWEEP debris platform', display: '1' },
    { label: 'Research papers & preprints', display: '6' },
    { label: 'AMC 12 competitors - AIME qualifier', display: 'Top 0.5%' },
    { label: 'FIRST World Championship qualifier', display: '2x' },
    { label: 'BPA National Leadership Conference', display: 'Top 10' },
    { label: 'NASA TAS Moonshot', display: '1st Place' },
  ] as Stat[],
  experiences: [
    {
      id: 'exp-stemtree',
      role: 'STEM Instructor',
      organization: 'STEMTree',
      period: 'Jan 2025 – Present',
      type: 'Teaching',
      description:
        'Instructed and mentored elementary and middle school students in STEM disciplines and robotics to foster interest through hands-on activities and personally tailored lessons. Broke down complex concepts into age-appropriate lessons, allowing students to grasp advanced disciplines. Represented STEMTree at local outreach events, inspiring and captivating families through direct demonstration of STEM; promoted accessibility to direct FLL-style robotics to children at a young age.',
    },
    {
      id: 'exp-bigfuture',
      role: 'Big Future Ambassador',
      organization: 'The College Board',
      period: 'Aug 2025 – Present',
      type: 'Leadership',
      description:
        'Selected as a BigFuture Ambassador, supporting peers in exploring career paths, planning for college, and accessing scholarship opportunities through BigFuture. Actively collaborate with fellow ambassadors on a monthly basis to share resources, insights, and opportunities.',
    },
    {
      id: 'exp-teen-court',
      role: 'Teen Court Attorney & Juror',
      organization: 'City of Allen',
      period: 'Jan 2025 – Jan 2026',
      type: 'Community Service',
      description:
        'Represent teenagers who have committed Class C misdemeanors. Follow court proceedings and provide legal defense to juvenile offenders. As a juror, serve alongside my peers to sentence offenders.',
    },
    {
      id: 'exp-icode',
      role: 'AI Intern and STEM Instructor',
      organization: 'iCode School Franchise',
      period: 'Mar 2024 – Jul 2024',
      type: 'Internship',
      description:
        'Collaborated to develop AI-driven tools and models to create an innovative curriculum for the iCode Franchise. Worked to create tools used by Instructors nationwide to help with instruction (including AI bots to aid students). Taught both weekly and summer camps in computer science, engineering, and core STEM disciplines to aspiring children, fostering their love for STEM through structured lessons and projects.',
    },
  ] as Experience[],
  awards: [
    {
      id: 'award-nasa-tas',
      category: 'Aerospace',
      title: 'NASA TAS Moonshot - 1st Place',
      // TODO(ansh): expand this. Everything here is what was stated directly;
      // the challenge brief, what was designed, the team size and the year are
      // all unknown, and this card reads thin next to the others until they are
      // filled in. Nothing below should be embellished without a source.
      description: 'First place in the NASA TAS Moonshot challenge.',
    },
    {
      id: 'award-gita',
      category: 'Achievement',
      title: 'Bhagavad Gita Memorizer & World Record Participant',
      description:
        "Memorized 800+ verses - 10,000+ Sanskrit words - of the Srimad Bhagavad Gita across a year of 30-40 hour weeks. Guinness World Records title holder for 'Largest simultaneous Hindu text recital', which took 2+ years of preparation.",
    },
    {
      id: 'award-first',
      category: 'Robotics',
      title: 'FIRST Robotics Awards',
      description:
        'FIRST Impact Award and Engineering Inspiration Award with Team 6369, plus the Autonomous Award twice. Two-time FIRST World Championship qualifier and Texas State qualifier; won the FIT Belton, Amarillo, and San Antonio competitions.',
    },
    {
      id: 'award-aime',
      category: 'Mathematics',
      title: 'AIME Qualifier',
      description:
        'Scored 118.5/150 on the AMC 12 to qualify for the American Invitational Mathematics Examination (AIME), then 7/15 on the AIME - the top 0.5% of all AMC competitors.',
    },
    {
      id: 'award-music',
      category: 'Music',
      title: 'Heritage HS Wind Ensemble & Drumline',
      description:
        '1st place at the 2025 International Percussion Ensemble competition, performed at PASIC50 in Indianapolis. Outstanding Snare Line at the 2025 North Texas Drumline Contest, and contest winner in 2024. Three-time All-Region selection; currently on snare, at 40+ hours a week during peak season.',
    },
    {
      id: 'award-bpa',
      category: 'Leadership',
      title: 'Business Professionals of America (BPA)',
      description:
        'Chapter Vice President. Regional Champion in 2025 and 2026 (1st place, two-time State qualifier) and a two-time National Torch Award recipient. Top 10 finalist at the 2026 National Leadership Conference.',
    },
    {
      id: 'award-conrad',
      category: 'Innovation',
      title: 'Conrad Challenge Innovator',
      description: '2026 Conrad Challenge Innovator.',
    },
    {
      id: 'award-cs-club',
      category: 'Academics',
      title: 'HHS Computer Science Club',
      description: 'Scored Top 50 across Texas in 10th Grade & 5A Divisions.',
    },
    {
      id: 'award-math-honors',
      category: 'Mathematics',
      title: 'HHS Math Honors Society',
      description: '1st Place General Math Team at UIL District Meet 2024-25.',
    },
    {
      id: 'award-key-club',
      category: 'Leadership',
      title: 'Heritage High School Key Club',
      description: 'Secretary with over 150 members and various events throughout the year.',
    },
  ] as Award[],
  ism: {
    programName: 'Independent Study & Mentorship',
    district: 'Frisco ISD',
    tagline: 'Choose excellence. Exemplify character.',
    description:
      'I spent my ISM year building STRATOS, a flight-performance simulator, under Dr. Giuseppe Cataldo, Assistant Chief for Technology at NASA Goddard - alongside five research assessments on quantum aerospace, CFD, autonomous flight, and supersonic versus subsonic flight, plus interviews with engineers at Lockheed Martin, NASA, and an aerospace startup. ISM is a competitive Frisco ISD elective that lets juniors and seniors study one career field independently through research, professional interviews, and mentorship.',
    image: '/ism-program.png',
    focus: 'Aerospace engineering and flight mechanics',
  },
  contact: {
    heading: 'Get in touch',
    message:
      'Open to collaborations, mentorship, and internship opportunities in aerospace engineering and STEM.',
  },
  disciplines: [
    'Aerospace Engineering',
    'Flight Mechanics',
    'Quantum Mechanics',
    'Propulsion Systems',
    'Robotics',
    'Mission Design',
  ],
  missionBriefing:
    'This site was built as a flight-ready portfolio - every animation is scroll-synced and every section responds to your scroll. Built with React, Three.js, and Motion. Clearance level: PUBLIC.',
}

export const SECTION_IDS = [
  'intro',
  'hero',
  'about',
  'projects',
  'research',
  'ism',
  'stats',
  'contact',
] as const

export type SectionId = (typeof SECTION_IDS)[number]

export function getPaperBySlug(slug: string): Paper | undefined {
  return portfolio.papers.find((p) => p.slug === slug)
}

/** Slug for the featured research paper (shown outside the binder with 3D airfoil). */
export const FEATURED_RESEARCH_SLUG = 'morphing-airfoil-qaoa'

export function getFeaturedResearchPaper(): Paper | undefined {
  return portfolio.papers.find((p) => p.slug === FEATURED_RESEARCH_SLUG)
}

/** @deprecated Binder removed - use RESEARCH_SHOWCASE from researchShowcase.ts */
export function getBinderPapers() {
  return portfolio.papers.filter((p) => p.slug !== FEATURED_RESEARCH_SLUG)
}

export const SECTION_LABELS: Record<SectionId, string> = {
  intro: 'Home',
  hero: 'Profile',
  about: 'About',
  projects: 'Projects',
  research: 'Research',
  ism: 'ISM',
  stats: 'Awards',
  contact: 'Contact',
}
