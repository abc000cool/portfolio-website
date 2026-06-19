import { useState, type FormEvent } from 'react'
import { portfolio } from '../data/portfolio'
import { externalLinkRel } from '../lib/externalLink'
import { useWaypointReached } from '../context/MissionContext'
import { RedactedHeading } from '../components/ui/RedactedHeading'
import { ScanWipe } from '../components/ui/ScanWipe'
import { sectionShellClass } from '../lib/waypointLayout'

export function ContactSection() {
  const active = useWaypointReached('contact')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    const name = data.get('name')
    const email = data.get('email')
    const message = data.get('message')
    const subject = encodeURIComponent(`Portfolio Contact from ${name}`)
    const body = encodeURIComponent(String(message) + `\n\n— ${name} (${email})`)
    window.location.href = `mailto:${portfolio.identity.email}?subject=${subject}&body=${body}`
    setSubmitted(true)
  }

  return (
    <section
      id="contact"
      data-mission-waypoint
      data-waypoint-side="center"
      className={sectionShellClass('center')}
      aria-labelledby="contact-heading"
    >
      <div className="section-inner wide--narrow">
        <p className="section-label">Contact</p>
        <div id="contact-heading" className="mb-4">
          <RedactedHeading active={active}>{portfolio.contact.heading}</RedactedHeading>
        </div>
        <ScanWipe active={active}>
          <p className="text-slate-400 mb-8 leading-relaxed">{portfolio.contact.message}</p>

          <div className="crt-terminal">
            <div className="crt-terminal__content">
              <div className="mb-6 space-y-1 text-sm">
                <p className="m-0">
                  <span className="crt-terminal__prompt">&gt;</span>
                  FLIGHT LOG — FINAL ENTRY
                </p>
                <p className="m-0 opacity-80">
                  <span className="crt-terminal__prompt">&gt;</span>
                  comms link established… OK
                </p>
                <p className="m-0 opacity-80">
                  <span className="crt-terminal__prompt">&gt;</span>
                  channel open — transmit when ready <span className="crt-terminal__cursor" />
                </p>
              </div>

              <form onSubmit={handleSubmit} aria-label="Contact form">
                <label htmlFor="contact-name">Name</label>
                <input
                  id="contact-name"
                  name="name"
                  required
                  autoComplete="name"
                  placeholder="your name"
                />

                <label htmlFor="contact-email">Email</label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@email.com"
                />

                <label htmlFor="contact-message">Message</label>
                <textarea
                  id="contact-message"
                  name="message"
                  rows={4}
                  required
                  placeholder="tell me about your project or opportunity…"
                />

                <div className="flex items-center gap-4 mt-6">
                  <button
                    type="submit"
                    className="px-5 py-2 font-mono text-sm uppercase tracking-widest border border-[var(--color-phosphor)] text-[var(--color-phosphor)] bg-transparent cursor-pointer hover:bg-[rgba(134,239,172,0.08)] transition-colors"
                  >
                    Transmit ▸
                  </button>
                  {submitted && (
                    <span className="font-mono text-xs opacity-80" role="status">
                      transmission queued — opening mail client…
                    </span>
                  )}
                </div>
              </form>

              <div className="mt-8 pt-5 border-t border-[rgba(134,239,172,0.2)]">
                <p className="font-mono text-xs mb-3 opacity-80">{portfolio.identity.email}</p>
                <div className="flex flex-wrap gap-4">
                  {portfolio.identity.socials.map((s) => (
                    <a
                      key={s.label}
                      href={s.url}
                      rel={externalLinkRel(s.url)}
                      className="font-mono text-xs uppercase tracking-wider underline underline-offset-4 decoration-[rgba(134,239,172,0.4)] hover:decoration-[var(--color-phosphor)] transition-colors"
                    >
                      {s.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </ScanWipe>
      </div>
    </section>
  )
}
