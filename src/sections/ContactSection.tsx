import { useEffect, useRef, useState, type FormEvent } from 'react'
import { portfolio } from '../data/portfolio'
import { externalLinkRel } from '../lib/externalLink'
import { RedactedHeading } from '../components/ui/RedactedHeading'
import { ScanWipe } from '../components/ui/ScanWipe'
import { useSectionReveal } from '../hooks/useSectionReveal'
import { sectionShellClass } from '../lib/waypointLayout'

const EMAIL = portfolio.identity.email

/** LinkedIn/GitHub get real buttons; the mailto social duplicates the copy control above. */
const PROFILE_LINKS = portfolio.identity.socials.filter((s) => !s.url.startsWith('mailto:'))

const btnBase =
  'inline-flex items-center gap-2 px-5 py-3 font-mono text-sm uppercase tracking-widest no-underline cursor-pointer transition-colors border'
const btnPrimary =
  'border-[var(--color-phosphor)] bg-[rgba(134,239,172,0.14)] text-[var(--color-phosphor)] hover:bg-[rgba(134,239,172,0.24)]'
const btnSecondary =
  'border-[rgba(134,239,172,0.35)] bg-transparent text-[var(--color-phosphor)] hover:bg-[rgba(134,239,172,0.08)] hover:border-[var(--color-phosphor)]'

type CopyState = 'idle' | 'copied' | 'failed'

export function ContactSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const active = useSectionReveal('contact', sectionRef)
  const addressRef = useRef<HTMLSpanElement>(null)
  const resetRef = useRef<number | null>(null)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [mailAttempted, setMailAttempted] = useState(false)

  useEffect(
    () => () => {
      if (resetRef.current) window.clearTimeout(resetRef.current)
    },
    [],
  )

  const flash = (next: Exclude<CopyState, 'idle'>) => {
    setCopyState(next)
    if (resetRef.current) window.clearTimeout(resetRef.current)
    resetRef.current = window.setTimeout(() => setCopyState('idle'), 6000)
  }

  /** Fallback for browsers/contexts where the clipboard API is unavailable. */
  const selectAddress = () => {
    const node = addressRef.current
    if (!node) return
    const range = document.createRange()
    range.selectNodeContents(node)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  const copyEmail = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(EMAIL)
        flash('copied')
        return
      }
    } catch {
      /* fall through to manual selection */
    }
    selectAddress()
    flash('failed')
  }

  /**
   * There is no backend. This hands the draft to whatever mail handler the
   * device has registered — which on a managed desktop may be none at all — so
   * the status text below says exactly that and never claims a message was sent.
   */
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const data = new FormData(e.target as HTMLFormElement)
    const name = data.get('name')
    const email = data.get('email')
    const message = data.get('message')
    const subject = encodeURIComponent(`Portfolio Contact from ${name}`)
    const body = encodeURIComponent(String(message) + `\n\n— ${name} (${email})`)
    window.location.href = `mailto:${EMAIL}?subject=${subject}&body=${body}`
    setMailAttempted(true)
  }

  return (
    <section
      ref={sectionRef}
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
                  channel open — address below <span className="crt-terminal__cursor" />
                </p>
              </div>

              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] opacity-70 m-0 mb-2">
                Direct channel
              </p>
              <p className="font-mono text-lg md:text-xl break-all m-0 mb-4">
                <span ref={addressRef}>{EMAIL}</span>
              </p>

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={copyEmail} className={`${btnBase} ${btnPrimary}`}>
                  {copyState === 'copied' ? 'Copied ✓' : 'Copy address'}
                </button>
                {PROFILE_LINKS.map((s) => (
                  <a
                    key={s.label}
                    href={s.url}
                    rel={externalLinkRel(s.url)}
                    className={`${btnBase} ${btnSecondary}`}
                  >
                    {s.label} ↗
                  </a>
                ))}
              </div>

              <p className="font-mono text-xs opacity-80 mt-3 m-0 min-h-[1.25rem]" role="status">
                {copyState === 'copied' && 'copied — the address is on your clipboard'}
                {copyState === 'failed' &&
                  'could not copy automatically — the address is selected, press Ctrl/Cmd+C'}
              </p>

              <div className="mt-8 pt-6 border-t border-[rgba(134,239,172,0.2)]">
                <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] opacity-70 m-0">
                  Or draft it here
                </p>
                <p className="font-mono text-xs opacity-60 mt-1 mb-2 m-0">
                  this fills a draft in your own mail app — nothing is sent from this page
                </p>

                <form onSubmit={handleSubmit} aria-label="Draft an email">
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

                  <div className="mt-6">
                    <button type="submit" className={`${btnBase} ${btnSecondary}`}>
                      Open in mail client ▸
                    </button>
                    <p className="font-mono text-xs opacity-80 mt-3 m-0" role="status">
                      {mailAttempted &&
                        'opening your mail client — if nothing happens, copy the address above'}
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </ScanWipe>
      </div>
    </section>
  )
}
