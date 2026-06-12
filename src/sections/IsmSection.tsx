import { Link } from 'react-router-dom'
import { portfolio } from '../data/portfolio'
import { useWaypointReached } from '../context/MissionContext'
import { RedactedHeading } from '../components/ui/RedactedHeading'
import { ScanWipe } from '../components/ui/ScanWipe'
import { sectionShellClass } from '../lib/waypointLayout'

export function IsmSection() {
  const active = useWaypointReached('ism')
  const { ism } = portfolio

  return (
    <section
      id="ism"
      data-mission-waypoint
      data-waypoint-side="center"
      className={`${sectionShellClass('center')} relative overflow-hidden`}
      aria-labelledby="ism-heading"
    >
      <div className="section-inner wide">
        <p className="section-label">{ism.district} Program</p>
        <div id="ism-heading" className="mb-6">
          <RedactedHeading active={active}>{ism.programName}</RedactedHeading>
        </div>

        <ScanWipe active={active}>
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-indigo-300/90 mb-3">
                {ism.tagline}
              </p>
              <p className="text-[var(--color-text-muted)] text-lg leading-relaxed mb-6">
                {ism.description}
              </p>
              <p className="text-sm text-slate-400 mb-8">
                <span className="text-[var(--color-cockpit-amber)] font-mono text-xs uppercase tracking-wider mr-2">
                  Focus
                </span>
                {ism.focus}
              </p>
              <Link
                to="/ism"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-mono text-xs uppercase tracking-widest text-white bg-indigo-500/20 border border-indigo-400/40 hover:bg-indigo-500/30 transition-colors no-underline"
              >
                Explore ISM journey →
              </Link>
            </div>

            <div className="glass-card overflow-hidden">
              <img
                src={ism.image}
                alt="Independent Study and Mentorship program"
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </ScanWipe>
      </div>
    </section>
  )
}
