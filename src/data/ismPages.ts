export interface IsmResearchAssessment {
  number: number
  title: string
  date: string
  description: string
  tags: string[]
  pdfUrl: string
}

export interface IsmInterview {
  number: number
  name: string
  role: string
  date: string
  summary: string
  insights: string[]
  pdfUrl: string
}

export interface IsmMentorMeeting {
  number: number
  title: string
  date: string
  format: string
  summary: string
  takeaways: string[]
  pdfUrl: string
}

export interface IsmDocument {
  title: string
  description: string
  pdfUrl: string
}

export const ismResearchAssessments: IsmResearchAssessment[] = [
  {
    number: 1,
    title: 'Quantum Applications in Aerospace',
    date: 'September 11, 2025',
    description:
      'Exploration of quantum computing applications in aerospace engineering. Investigates how qubits and quantum algorithms can enhance optimization, materials science, cryptography, and simulation/modeling. Examines the potential for quantum-powered trajectory prediction, advanced fighter jet modeling, and AI acceleration in the aerospace industry.',
    tags: ['Quantum Computing', 'Aerospace', 'Optimization'],
    pdfUrl:
      'https://blobs.vusercontent.net/blob/Ansh_Pathak_RA1_9.11.2025-ESS6ohAavLRsWxP97x2DD8XVOelKnP.pdf',
  },
  {
    number: 2,
    title: 'Computational Fluid Dynamics',
    date: 'September 18, 2025',
    description:
      'Introduction to Computational Fluid Dynamics (CFD) and its applications in aerospace engineering. Explores how CFD models use Navier-Stokes equations to simulate fluid motion, enabling cost-effective virtual testing of aircraft designs. Investigates potential quantum computing applications to accelerate CFD simulations.',
    tags: ['CFD', 'Navier-Stokes', 'Simulation'],
    pdfUrl:
      'https://blobs.vusercontent.net/blob/Ansh_Pathak_RA2_9.18.2025-O9mEu2s4Z2CscUdTAMErTqM7Aqt7eo.pdf',
  },
  {
    number: 3,
    title: 'ISM Symposium Reflection',
    date: 'September 25, 2025',
    description:
      'Reflection on the ISM Business Symposium experience. Discusses networking strategies with professionals, interview preparation, communication improvement areas, and key advice received on cold emailing and professional outreach. Emphasizes the importance of adaptability when networking with diverse professionals.',
    tags: ['Professional Development', 'Networking', 'Communication'],
    pdfUrl:
      'https://blobs.vusercontent.net/blob/Ansh_Pathak_RA3_9.25.2025-xFkZTxbeNccMUWVesBdTBOHzI4ORGu.pdf',
  },
  {
    number: 4,
    title: 'Autonomous Flight',
    date: 'October 24, 2025',
    description:
      'Exploration of autonomous flight technology and its future in aviation. Investigates the evolution from military UAVs to modern pilotless aircraft, examining how AI, machine learning, and advanced sensors enable autonomous operations. Analyzes the benefits including enhanced safety through reduced human error, increased fuel efficiency, and potential for streamlined air traffic management.',
    tags: ['Autonomous Flight', 'AI', 'Aviation'],
    pdfUrl:
      'https://blobs.vusercontent.net/blob/Ansh_Pathak_RA4_10.24.25-r5rDoMtW2GM9bD7U6vASnQJVUWuN52.pdf',
  },
  {
    number: 5,
    title: 'Supersonic vs Subsonic Speed',
    date: 'November 30, 2025',
    description:
      'Comprehensive analysis of the differences between supersonic and subsonic flight mechanics. Explores how airflow characteristics, shock wave formation, and aerodynamic behavior differ between these speed regimes. Examines the impact on lift generation, drag forces, and wing design considerations for different aircraft applications.',
    tags: ['Flight Mechanics', 'Aerodynamics', 'Shock Waves'],
    pdfUrl:
      'https://blobs.vusercontent.net/blob/Ansh_Pathak_RA5_11.30.25-p6c3SmjqZHpXfZ01KeWAjapzlpHoBk.pdf',
  },
]

export const ismInterviews: IsmInterview[] = [
  {
    number: 1,
    name: 'Ms. Aubrey Baker',
    role: 'F-22 Systems Engineer at Lockheed Martin',
    date: 'October 14, 2025',
    summary:
      'First professional interview with a Lockheed Martin systems engineer and FISD alumni. Discussed career trajectory from UT Austin to Georgia Tech, work in the Skunkworks division, and advice on pursuing aerospace engineering degrees. Learned about the difference between legacy and Skunkworks divisions, and the rewarding aspects of seeing designs in production.',
    insights: [
      'Pursue degree based on interests, not just job market',
      'Prioritize experiences over grades',
      'Join AIAA organization',
    ],
    pdfUrl:
      'https://blobs.vusercontent.net/blob/Ansh_Pathak_IA1_10.28.25-fpQorDEczHAJW9ULnPDn2TMkMEtLjy.pdf',
  },
  {
    number: 2,
    name: 'Dr. Giuseppe Cataldo',
    role: 'Assistant Chief of Technology at NASA',
    date: 'November 6, 2025',
    summary:
      "Interview with NASA's Assistant Chief of Technology who manages over $30 million in budget and has 20+ research publications. Discussed his journey from MIT research to NASA, the mission lifecycle process, and the importance of professional growth. Received invaluable advice on pursuing summer internships and diversifying engineering knowledge.",
    insights: [
      'Learn as much as possible across disciplines',
      'Pursue summer internships for growth',
      'Creativity is key in aerospace',
    ],
    pdfUrl:
      'https://blobs.vusercontent.net/blob/Ansh_Pathak_IA2_11.10.25-erEh9qlKOB0F5GH5PeFYyCurXFve6Q.pdf',
  },
  {
    number: 3,
    name: 'Mr. Dylan Caruso',
    role: 'Aerospace Engineer at Brazos Innovation Partners',
    date: 'November 7, 2025',
    summary:
      'Interview with the sole aerospace engineer at a startup, providing unique perspective on startup vs. large corporation work. Discussed CFD work, propeller design for drones, and the importance of software skills (Python/Java, CAD/FEA/CFD). Gained insights on the benefits of working at a startup for hands-on learning.',
    insights: [
      'Software skills are critical (Python, CAD, CFD)',
      'Networking with professors helps in job search',
      'Working hard will reward you unexpectedly',
    ],
    pdfUrl:
      'https://blobs.vusercontent.net/blob/Ansh_Pathak_IA3_11.27.25-v1i0FUwNITlEtKv7rLBIg8crGhBXWI.pdf',
  },
]

export const ismMentor = {
  name: 'Dr. Giuseppe Cataldo',
  title: 'Assistant Chief for Technology',
  organization: 'NASA Goddard Space Flight Center',
  bio: "Dr. Giuseppe Cataldo has served as Assistant Chief for Technology, responsible for directing a multimillion-dollar research and development portfolio, driving strategic investments in advanced technologies for NASA's Moon to Mars program, planetary defense and national security across the 9-branch, 500+ employee Mechanical Systems Division. He also establishes and manages critical partnerships with NASA centers, academia and industry to accelerate technology maturation and infusion, and oversees new business development initiatives, securing funding and advancing innovative solutions for current and future NASA missions.",
  bioContinued:
    'Prior to this, he helped oversee and guide the planetary protection efforts of the Mars Sample Return (MSR) program. His expertise is in program, project and risk management, decision-making under uncertainty and systems engineering and integration for space missions over the entire lifecycle, with a strong background in modeling, analysis and optimization of complex, large-scale systems with applications for astronomy, astrophysics, planetary and Earth sciences.',
  focusAreas: [
    {
      title: 'Flight Mechanics Modeling',
      description: 'Developing computational models for aircraft performance analysis',
    },
    {
      title: 'Software Development',
      description: 'Python, R, and aerospace simulation tools for original work',
    },
    {
      title: 'Industry Insights',
      description: 'Real-world aerospace engineering practices and career guidance',
    },
  ],
}

export const ismMentorMeetings: IsmMentorMeeting[] = [
  {
    number: 1,
    title: 'Project Integration & Feedback',
    date: 'February 3, 2026',
    format: 'Zoom',
    summary:
      'First official mentor meeting focusing on integrating Dr. Cataldo into the ISM program and obtaining feedback on the Original Work Proposal. Received guidance on timeline adjustments, software selection (Python, R, Mathematica, SciLab), and statistical analysis approaches. Key outcome: shifting from statistical analysis to visualization outputs (contour curves, graphs, key metrics).',
    takeaways: [
      'Establish baseline model first, then add features as separate modules',
      'Python works fine for flight mechanics modeling — no need for fancy software',
      'Use informal testing during development, save formal testing for final report',
    ],
    pdfUrl:
      'https://blobs.vusercontent.net/blob/Ansh_Pathak_MA1_2.5.2026-iJ4hlSVr1Vh13lbt0K8NoGrecAGa9o.pdf',
  },
  {
    number: 2,
    title: 'Progress Review & Enhancement',
    date: 'February 18, 2026',
    format: 'Zoom',
    summary:
      'Second mentor meeting to demonstrate Original Work progress and receive feedback on additional features. Showed completed modules (atmospheric, aircraft object, aerodynamics, main method, app overlay). Received commendation for being 2–3 weeks ahead of schedule and achieving 1.5% accuracy on Boeing 737 stall speed calculations.',
    takeaways: [
      'Consider higher-precision drag model and variable atmospheric conditions',
      'Add separate tabs for atmospheric conditions, lift, drag analysis',
      'CFD integration would be complex — consider simple version or separate exploration',
    ],
    pdfUrl:
      'https://blobs.vusercontent.net/blob/Ansh_Pathak_MA2_2.18.2026-yEXaIg7BoDI4oWoFyoNpSJ3QrltM0W.pdf',
  },
]

export const ismFoundationalDocuments: IsmDocument[] = [
  {
    title: 'Career & Industry Forecast',
    description:
      'Comprehensive analysis of the aerospace engineering career path, including education requirements, salary expectations, job outlook, and professional development roadmap.',
    pdfUrl:
      'https://blobs.vusercontent.net/blob/013491_b90d8c98e9984616b843db0d80c22c41-Z6Od9sfjg3vl9taAcDyL5JsExZGAUv.pdf',
  },
  {
    title: 'Topic Proposal',
    description:
      'Detailed proposal outlining my ISM focus on aerospace engineering and flight mechanics, including personal background, interests, and goals for the independent study.',
    pdfUrl:
      'https://blobs.vusercontent.net/blob/013491_890113e083b14da49bb6b189a12cacbe-ANHtCLL1mKKjNMwMLEDZtF6OvWzpvA.pdf',
  },
]
