import { Link, useLocation } from 'react-router-dom'
import { portfolio } from '../data/portfolio'
import { SubpageShell } from '../components/layout/SubpageShell'
import { useDocumentHead } from '../hooks/useDocumentHead'

const DESTINATIONS = [
  {
    to: '/#projects',
    label: 'Selected projects',
    description: 'Simulation tools, spacecraft design, and engineering platforms.',
  },
  {
    to: '/#research',
    label: 'Research',
    description:
      'Papers across orbital debris mitigation, morphing airfoils, and hybrid quantum–classical navigation.',
  },
  {
    to: '/ism',
    label: portfolio.ism.programName,
    description: `Independent study in ${portfolio.ism.focus.toLowerCase()}.`,
  },
]

export function NotFoundPage() {
  const { pathname } = useLocation()

  useDocumentHead({
    title: `Page not found — ${portfolio.identity.name}`,
    description: 'That page does not exist. Head back to projects, research, or the homepage.',
  })

  return (
    <SubpageShell backLabel="Back to mission" backTo="/">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <p className="section-label">Error 404</p>
          <h1 className="font-display text-4xl md:text-5xl text-white mb-4 tracking-tight">
            Off the flight path
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">
            There is nothing at this address. The link may be out of date, or the page may have
            moved.
          </p>
          <p className="font-mono text-xs text-slate-600 mt-4 break-all">
            Requested: <span className="text-slate-500">{pathname}</span>
          </p>
        </header>

        <section>
          <h2 className="font-display text-xl text-white mb-5">Try one of these</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {DESTINATIONS.map((dest) => (
              <Link
                key={dest.to}
                to={dest.to}
                className="glass-card p-6 no-underline hover:border-indigo-400/30 transition-colors group"
              >
                <p className="font-mono text-[10px] uppercase tracking-wider text-indigo-300 mb-2">
                  Go to
                </p>
                <h3 className="font-display text-lg text-white mb-2 group-hover:text-indigo-200">
                  {dest.label}
                </h3>
                <p className="text-sm text-slate-400 m-0">{dest.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <nav className="mt-12 pt-8 border-t border-white/[0.06]">
          <Link to="/" className="link-underline text-sm text-indigo-300 no-underline">
            ← Return to the homepage
          </Link>
        </nav>
      </div>
    </SubpageShell>
  )
}
