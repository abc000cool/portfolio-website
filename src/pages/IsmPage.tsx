import { Link, Navigate, useParams } from 'react-router-dom'
import { portfolio } from '../data/portfolio'
import {
  ismFoundationalDocuments,
  ismInterviews,
  ismMentor,
  ismMentorMeetings,
  ismResearchAssessments,
} from '../data/ismPages'
import { SubpageShell } from '../components/layout/SubpageShell'

function PdfLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex link-underline text-xs font-medium text-indigo-300 mt-3"
    >
      View PDF →
    </a>
  )
}

function IsmOverview() {
  const { ism } = portfolio

  return (
    <>
      <header className="mb-12">
        <p className="section-label">{ism.district} Program</p>
        <h1 className="font-display text-4xl md:text-5xl text-white mb-4 tracking-tight">
          {ism.programName}
        </h1>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-indigo-300/90 mb-4">
          {ism.tagline}
        </p>
        <p className="text-lg text-slate-400 leading-relaxed max-w-3xl">{ism.description}</p>
      </header>

      <div className="glass-card overflow-hidden mb-12 max-w-2xl">
        <img
          src={ism.image}
          alt="Independent Study and Mentorship program"
          className="w-full h-auto object-cover"
        />
      </div>

      <section className="mb-14">
        <h2 className="font-display text-2xl text-white mb-6">Explore my ISM journey</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Link
            to="/ism/research"
            className="glass-card p-6 no-underline hover:border-indigo-400/30 transition-colors group"
          >
            <p className="font-mono text-[10px] uppercase tracking-wider text-indigo-300 mb-2">
              Research
            </p>
            <h3 className="font-display text-lg text-white mb-2 group-hover:text-indigo-200">
              Research assessments
            </h3>
            <p className="text-sm text-slate-400 m-0">
              5 independent research assessments exploring aerospace engineering and flight
              mechanics.
            </p>
          </Link>
          <Link
            to="/ism/interviews"
            className="glass-card p-6 no-underline hover:border-indigo-400/30 transition-colors group"
          >
            <p className="font-mono text-[10px] uppercase tracking-wider text-indigo-300 mb-2">
              Interviews
            </p>
            <h3 className="font-display text-lg text-white mb-2 group-hover:text-indigo-200">
              Professional interviews
            </h3>
            <p className="text-sm text-slate-400 m-0">
              Conversations with Lockheed Martin, NASA, and startup aerospace engineers.
            </p>
          </Link>
          <Link
            to="/ism/mentorship"
            className="glass-card p-6 no-underline hover:border-indigo-400/30 transition-colors group"
          >
            <p className="font-mono text-[10px] uppercase tracking-wider text-indigo-300 mb-2">
              Mentorship
            </p>
            <h3 className="font-display text-lg text-white mb-2 group-hover:text-indigo-200">
              Mentor experience
            </h3>
            <p className="text-sm text-slate-400 m-0">
              Guided learning with Dr. Giuseppe Cataldo at NASA Goddard.
            </p>
          </Link>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl text-white mb-6">Foundational documents</h2>
        <div className="space-y-4">
          {ismFoundationalDocuments.map((doc) => (
            <article key={doc.title} className="glass-card p-6">
              <h3 className="font-display text-lg text-white mb-2">{doc.title}</h3>
              <p className="text-slate-400 leading-relaxed m-0">{doc.description}</p>
              <PdfLink href={doc.pdfUrl} />
            </article>
          ))}
        </div>
      </section>
    </>
  )
}

function IsmResearchPage() {
  return (
    <>
      <header className="mb-10">
        <p className="section-label">ISM Program</p>
        <h1 className="font-display text-3xl md:text-4xl text-white mb-3">ISM Research Assessments</h1>
        <p className="text-slate-400 leading-relaxed">
          Independent research assessments exploring aerospace engineering and flight mechanics.
        </p>
      </header>
      <div className="space-y-6">
        {ismResearchAssessments.map((a) => (
          <article key={a.number} className="glass-card p-6 md:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <h2 className="font-display text-xl text-white m-0">{a.title}</h2>
              <span className="font-mono text-[10px] text-slate-500">{a.date}</span>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-indigo-300/80 mb-4">
              Assessment #{a.number}
            </p>
            <p className="text-slate-400 leading-relaxed mb-4">{a.description}</p>
            <div className="flex flex-wrap gap-2 mb-1">
              {a.tags.map((tag) => (
                <span key={tag} className="tag-badge text-[10px]">
                  {tag}
                </span>
              ))}
            </div>
            <PdfLink href={a.pdfUrl} />
          </article>
        ))}
      </div>
    </>
  )
}

function IsmInterviewsPage() {
  return (
    <>
      <header className="mb-10">
        <p className="section-label">ISM Program</p>
        <h1 className="font-display text-3xl md:text-4xl text-white mb-3">Professional Interviews</h1>
        <p className="text-slate-400 leading-relaxed">
          Conversations with industry professionals providing insights into the aerospace field.
        </p>
      </header>
      <div className="space-y-6">
        {ismInterviews.map((interview) => (
          <article key={interview.number} className="glass-card p-6 md:p-8">
            <p className="font-mono text-[10px] uppercase tracking-wider text-indigo-300/80 mb-2">
              Interview #{interview.number} · {interview.date}
            </p>
            <h2 className="font-display text-xl text-white mb-1">{interview.name}</h2>
            <p className="text-sm text-indigo-200/90 mb-4">{interview.role}</p>
            <p className="text-slate-400 leading-relaxed mb-5">{interview.summary}</p>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-2">
                Key insights
              </p>
              <ul className="space-y-2 m-0 p-0 list-none">
                {interview.insights.map((insight) => (
                  <li key={insight} className="text-sm text-slate-300 flex gap-2">
                    <span className="text-amber-400/90 shrink-0">▸</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
            <PdfLink href={interview.pdfUrl} />
          </article>
        ))}
      </div>
    </>
  )
}

function IsmMentorshipPage() {
  return (
    <>
      <header className="mb-10">
        <p className="section-label">ISM Program</p>
        <h1 className="font-display text-3xl md:text-4xl text-white mb-3">Mentorship Experience</h1>
        <p className="text-slate-400 leading-relaxed">
          Guided learning experience with an industry professional in aerospace engineering.
        </p>
      </header>

      <article className="glass-card p-6 md:p-8 mb-10">
        <p className="font-mono text-[10px] uppercase tracking-wider text-indigo-300/80 mb-2">
          Mentor
        </p>
        <h2 className="font-display text-2xl text-white mb-1">{ismMentor.name}</h2>
        <p className="text-indigo-200/90 mb-4">
          {ismMentor.title} · {ismMentor.organization}
        </p>
        <p className="text-slate-400 leading-relaxed mb-4">{ismMentor.bio}</p>
        <p className="text-slate-400 leading-relaxed m-0">{ismMentor.bioContinued}</p>
      </article>

      <section className="mb-10">
        <h2 className="font-display text-xl text-white mb-5">Mentorship focus areas</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {ismMentor.focusAreas.map((area) => (
            <div key={area.title} className="glass-card p-5">
              <h3 className="font-display text-base text-white mb-2">{area.title}</h3>
              <p className="text-sm text-slate-400 m-0">{area.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-white mb-5">Mentor assessments</h2>
        <div className="space-y-6">
          {ismMentorMeetings.map((meeting) => (
            <article key={meeting.number} className="glass-card p-6 md:p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                <h3 className="font-display text-lg text-white m-0">{meeting.title}</h3>
                <span className="font-mono text-[10px] text-slate-500">
                  {meeting.date} · {meeting.format}
                </span>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-indigo-300/80 mb-4">
                Meeting #{meeting.number}
              </p>
              <p className="text-slate-400 leading-relaxed mb-4">{meeting.summary}</p>
              <ul className="space-y-2 m-0 p-0 list-none mb-1">
                {meeting.takeaways.map((t) => (
                  <li key={t} className="text-sm text-slate-300 flex gap-2">
                    <span className="text-emerald-400/90 shrink-0">▸</span>
                    {t}
                  </li>
                ))}
              </ul>
              <PdfLink href={meeting.pdfUrl} />
            </article>
          ))}
        </div>
      </section>
    </>
  )
}

const ISM_SUBPAGES = new Set(['research', 'interviews', 'mentorship'])

export function IsmPage() {
  const { section } = useParams<{ section?: string }>()

  if (section && !ISM_SUBPAGES.has(section)) {
    return <Navigate to="/ism" replace />
  }

  return (
    <SubpageShell backLabel="Back to mission" backTo="/#ism">
      <div className="max-w-4xl mx-auto">
        {section === 'research' && <IsmResearchPage />}
        {section === 'interviews' && <IsmInterviewsPage />}
        {section === 'mentorship' && <IsmMentorshipPage />}
        {!section && <IsmOverview />}

        {section && (
          <nav className="mt-12 pt-8 border-t border-white/[0.06] flex flex-wrap gap-4">
            <Link to="/ism" className="link-underline text-sm text-indigo-300 no-underline">
              ← ISM overview
            </Link>
            {section !== 'research' && (
              <Link to="/ism/research" className="text-sm text-slate-400 hover:text-white">
                Research
              </Link>
            )}
            {section !== 'interviews' && (
              <Link to="/ism/interviews" className="text-sm text-slate-400 hover:text-white">
                Interviews
              </Link>
            )}
            {section !== 'mentorship' && (
              <Link to="/ism/mentorship" className="text-sm text-slate-400 hover:text-white">
                Mentorship
              </Link>
            )}
          </nav>
        )}
      </div>
    </SubpageShell>
  )
}
