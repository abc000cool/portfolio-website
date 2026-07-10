export interface SocialLink {
  label: string
  url: string
}

import { projectPages, type ProjectGroup } from './projectPages'

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
}

export interface Paper {
  id: string
  slug: string
  title: string
  venue: string
  year: number
  abstract: string
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
    title: 'Aspiring Aerospace Engineer',
    tagline:
      'A driven high school senior with a passion for aerospace engineering, quantum mechanics, and innovative solutions. Building the future through STEM, one project at a time.',
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
      text: 'What we do in life, echos in eternity',
      attribution: 'Maximus Decimus Meridius',
    },
  },
  about: {
    bio: 'I am a driven and adept senior at Heritage High School with a strong passion for STEM fields, especially aerospace engineering and quantum mechanics. Backed by 7+ years of programming and engineering experience and a demonstrated ability to solve complex problems and create innovative solutions, I actively seek opportunities to pursue professional development, innovate, lead, and apply my skills in real-world projects through hands-on work, rigor, and impactful collaborations.',
    missionStatement:
      'Through my independent study, I wish to litanize my pursuit of knowledge in the broader field of aerospace engineering, and in the specificity of flight mechanics. I want to start with flight mechanics and then observe applications to this field with either optimization or quantum applications. I will gain the skills and learn about the expertise needed to professionally contribute to the industry in my future career through my final project and mentorship.',
    highlights: [
      'US Patent Holder — developed SWEEP, a novel solution to space debris proliferation',
      'FIRST World Championship Qualifier — outstanding robotics contributions with Team 6369',
      'Quantum Computing Practicum — studied quantum algorithms with UT Dallas faculty',
      'Nonprofit Founder — founded The Resonance Foundation, a 501(c)(3) music education nonprofit',
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
  })) as Project[],
  papers: [
    {
      id: 'paper-debris',
      slug: 'space-debris-mitigation',
      title: 'Space Debris Mitigation',
      venue: 'AAS 248 — Pasadena, CA',
      year: 2026,
      abstract:
        "Research on novel approaches to address the growing problem of space debris in Earth's orbit, including spacecraft design and operational algorithms. This work explores active debris removal strategies, mission planning optimization, and the development of practical solutions for space sustainability.",
    },
    {
      id: 'paper-traffic',
      slug: 'traffic-fluid-dynamics',
      title: 'Traffic Optimization Through Fluid Dynamics',
      venue: 'Pending',
      year: 2026,
      abstract:
        'Applies principles of fluid mechanics to model traffic patterns and deliver driving recommendations that dissipate congestion faster. Traffic is treated as fluid flow using computational fluid dynamics and Navier-Stokes-based modeling to identify bottlenecks and predict congestion waves in real time. Adaptive speed guidance is calculated so collective driver behavior can reduce stop-and-go patterns, improve average flow speeds, and lower fuel consumption—with research indicating substantial jam reduction and meaningful speed improvements at modest connected-vehicle penetration rates.',
    },
    {
      id: 'paper-morphing-airfoil',
      slug: 'morphing-airfoil-qaoa',
      title:
        'Probabilistic Optimization of Continuous-Morphing Airfoil Geometries via Gaussian Process Surrogates and QAOA-Based Discrete Sampling',
      venue: 'Pending',
      year: 2026,
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
      abstract:
        'A validated open-source simulator of a cold-atom interferometer + classical IMU hybrid navigator (Cheiney–Lautier–Wang architecture in a 15-state error-state EKF), paired with a global Sobol′ variance decomposition of its error budget across two opposite aerospace regimes: an atmospheric UAV under GNSS jamming, and a multi-day cislunar coast. Across 27,648 simulations and eight passing validation tests, the hybrid holds a median 7.6 m after five minutes of jamming (about 4.9× tighter than classical-only) and 124 km after a 4.98-day lunar coast versus 38,800 km unaided (313×). The study shows the remaining atmospheric error is dominated by gyroscope bias and platform vibration, while the cislunar floor is governed by classical accelerometer bias and coast duration—not cold-atom stability alone.',
      abstractHtml:
        'A validated open-source simulator of a cold-atom interferometer + classical IMU hybrid navigator (Cheiney–Lautier–Wang architecture in a 15-state error-state EKF), paired with a global Sobol′ variance decomposition of its error budget across two opposite aerospace regimes: an atmospheric UAV under GNSS jamming, and a multi-day cislunar coast. Across 27,648 simulations and eight passing validation tests, the hybrid holds a median <strong>7.6&nbsp;m</strong> after five minutes of jamming (~4.9× tighter than classical-only) and <strong>124&nbsp;km</strong> after a 4.98-day lunar coast versus 38,800&nbsp;km unaided (313×). Scenario&nbsp;A residual error is dominated by gyroscope bias (S<sub>T</sub>=0.48) and platform vibration (S<sub>T</sub>=0.46); Scenario&nbsp;B is governed by classical accelerometer bias (S<sub>T</sub>=0.56) and coast duration (S<sub>T</sub>=0.31), with CAI systematic bias contributing only S<sub>T</sub>=0.03. Dynamics use CR3BP targeting of a 3,250&nbsp;km Gateway NRHO perilune and are cross-checked against the DE440 ephemeris.',
    },
  ] as Paper[],
  stats: [
    { label: 'US Patent Holder', display: 'SWEEP' },
    { label: 'World Championship Qualifier', value: 2, suffix: 'x (FIRST)', static: true },
    { label: 'BPA National Finalist', display: 'Top 10' },
    { label: 'Top 0.5% AIME Scorer', display: 'AMC 12' },
  ] as Stat[],
  experiences: [
    {
      id: 'exp-stemtree',
      role: 'STEM Instructor',
      organization: 'STEMTree',
      period: 'Jan 2025 – Present',
      type: 'Teaching',
      description:
        'Instructed and mentored elementary and middle school students in STEM disciplines and robotics to foster interest through hands-on activities and personally tailored lessons. Broken down complex concepts into age-appropriate lessons, allowing students to grasp advanced disciplines. Represented STEMTree at local outreach events, inspiring and captivating families through direct demonstration of STEM; promoted accessibility to direct FLL-style robotics to children at a young age.',
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
      id: 'award-gita',
      category: 'Achievement',
      title: 'Bhagavad Gita Memorizer & World Record Participant',
      description:
        "Memorized 800+ verses (10,000+ Sanskrit words) of Srimad Bhagavad Gita, consistently spending 30-40+ hours weekly for over a year. Guinness Book of World Records Title Holder for 'Largest simultaneous Hindu text recital' requiring 2+ years of consistent preparation.",
    },
    {
      id: 'award-first',
      category: 'Robotics',
      title: 'FIRST Robotics Awards',
      description:
        'Received the prestigious FIRST Impact Award, Engineering Inspiration Award, and (2x) Autonomous Award with Team 6369. Qualified for (3 times) Texas State and FIRST World Championships; Won FIT Belton, Amarillo, & San Antonio Competitions.',
    },
    {
      id: 'award-aime',
      category: 'Mathematics',
      title: 'AIME Qualifier',
      description:
        'Scored 118.5/150 on the AMC 12; Qualified for American Invitational Mathematics Examination (AIME). Scored 7/15 on the AIME, landing in the top 0.5% of all AMC competitors.',
    },
    {
      id: 'award-music',
      category: 'Music',
      title: 'Heritage HS Wind Ensemble & Drumline',
      description:
        'Rigorously rehearse and compete in Marching Band, Concert Band, and Percussion Ensemble environments. Extremely strong time commitment, climbing over 40+ hours a week during peak times. 2025 1st Place International Percussion Ensemble Winner — Performed on a world stage at PASIC50 in Indianapolis. 2022-23 All-Region Percussion Ensemble, 2023-24 All-Region Band, 2024-25 All-Region Band. 2025 North Texas Drumline Contest Outstanding Snare Line. 2024 North Texas Drumline Contest Winner. 2023 McKinney Marching 1st Place Percussion. 2023-24 & 2024-25 Bass Line; 2025-26 Snare Line.',
    },
    {
      id: 'award-bpa',
      category: 'Leadership',
      title: 'Business Professionals of America (BPA)',
      description:
        'Chapter Vice President. 2025 & 2026 Regional Champion (1st Place, 2x State Qualifier) & 2x National Torch Award Recipient. 2026 National Leadership Conference Finalist (Top 10).',
    },
    {
      id: 'award-conrad',
      category: 'Innovation',
      title: 'Conrad Challenge Innovator',
      description:
        '2026 Conrad Challenge Innovator — participating in the prestigious innovation competition.',
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
      'Admission into ISM is highly competitive, requiring students to demonstrate strong commitment and high academic standing. This elective, available to juniors and seniors in Frisco ISD, enables students to independently explore a career field they\'re passionate about. Through extensive research, professional interviews, and mentorship, students gain hands-on experience and invaluable insights into their chosen industry.',
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
    'This site was built as a flight-ready portfolio — every animation is scroll-synced and every section responds to your scroll. Built with React, Three.js, and Motion. Clearance level: PUBLIC.',
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

/** @deprecated Binder removed — use RESEARCH_SHOWCASE from researchShowcase.ts */
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
