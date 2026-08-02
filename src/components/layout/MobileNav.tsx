import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { portfolio, SECTION_LABELS, type SectionId } from '../../data/portfolio'
import { getProjectsByGroup } from '../../data/projectPages'
import { RESEARCH_SHOWCASE, getResearchShowcasePaper } from '../../data/researchShowcase'
import { scrollToSection } from '../../lib/lenis'

/** Biography sections — work is listed first, Connect is the contact CTA. */
const BIO_SECTIONS: SectionId[] = ['about', 'stats']

/** Condensed forms of the research titles, matching the desktop nav. */
const RESEARCH_NAV_LABELS: Record<string, string> = {
  'research-debris': 'Orbital debris mitigation',
  'research-airfoil': 'Morphing airfoil optimization',
  'research-flowstate': 'Fluid-dynamics traffic modeling',
  'research-qcin': 'Hybrid quantum–classical inertial navigation',
  'research-sailnko': 'Solar-sail non-Keplerian orbits',
  'research-transition': 'Boundary-layer transition prediction',
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * site-nav.css kills the outline on `.mobile-nav__link:focus-visible` and is
 * imported unlayered, so it outranks any Tailwind `outline-*` utility. An inset
 * box-shadow is untouched by that rule and cannot be clipped by the drawer's
 * own overflow.
 */
const FOCUS_RING = 'focus-visible:shadow-[inset_0_0_0_2px_#818cf8]'

function visibleFocusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0,
  )
}

interface MobileNavProps {
  isHome: boolean
  activeId: string
}

export function MobileNav({ isHome, activeId }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const location = useLocation()
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  const close = useCallback(() => setOpen(false), [])

  // Close on any navigation — including browser back/forward, which no link
  // handler sees. Adjusting during render rather than in an effect avoids a
  // committed frame where the drawer is still open over the new route.
  const [renderedKey, setRenderedKey] = useState(location.key)
  if (renderedKey !== location.key) {
    setRenderedKey(location.key)
    if (open) setOpen(false)
  }

  const lockedOverflow = useRef('')

  useEffect(() => {
    if (!open) return
    lockedOverflow.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = lockedOverflow.current
    }
  }, [open])

  /**
   * React flushes the close *after* this click handler returns, so the body is
   * still locked when we try to move the page — and a locked body silently
   * clamps every programmatic scroll. Release it by hand first; the effect
   * cleanup writing the same value back later is a no-op.
   */
  const releaseScrollLock = useCallback(() => {
    document.body.style.overflow = lockedOverflow.current
  }, [])

  // Everything outside the drawer goes inert: aria-modal alone is a promise the
  // DOM does not keep, and below 768px this drawer is the only navigation, so
  // tabbing into fifty background controls is a dead end.
  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return

    const marked: HTMLElement[] = []
    let node: HTMLElement | null = panel
    while (node && node !== document.body) {
      const parent: HTMLElement | null = node.parentElement
      if (!parent) break
      for (const sibling of Array.from(parent.children)) {
        if (sibling === node) continue
        if (!(sibling instanceof HTMLElement)) continue
        // The backdrop must stay tappable — it is the close affordance.
        if (sibling.dataset.mobileNavKeep !== undefined) continue
        if (sibling.hasAttribute('inert')) continue
        sibling.setAttribute('inert', '')
        marked.push(sibling)
      }
      node = parent
    }

    return () => marked.forEach((el) => el.removeAttribute('inert'))
  }, [open])

  // Initial focus, Escape, and a real Tab cycle.
  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return

    const raf = requestAnimationFrame(() => {
      visibleFocusables(panel)[0]?.focus()
    })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key !== 'Tab') return

      const items = visibleFocusables(panel)
      if (items.length === 0) return

      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      const inside = active ? panel.contains(active) : false

      if (e.shiftKey) {
        if (!inside || active === first) {
          e.preventDefault()
          last.focus()
        }
      } else if (!inside || active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  // Declared after the inert effect so its cleanup has already run by the time
  // we hand focus back to the trigger.
  useEffect(() => {
    if (open) {
      wasOpen.current = true
      return
    }
    if (!wasOpen.current) return
    wasOpen.current = false
    triggerRef.current?.focus()
  }, [open])

  const goSection = (id: SectionId) => {
    close()
    if (!isHome) return
    releaseScrollLock()
    scrollToSection(id)
  }

  /**
   * Research entries only carry per-entry ids in the desktop showcase layout;
   * on the card layout fall back to the section rather than doing nothing.
   */
  const goResearchEntry = (id: string) => {
    close()
    if (!isHome) return
    releaseScrollLock()
    scrollToSection(document.getElementById(id) ? id : 'research')
  }

  const sectionHref = (id: SectionId) => (isHome ? undefined : `/#${id}`)

  const linkClass = (active: boolean) =>
    `mobile-nav__link ${FOCUS_RING}${active ? ' mobile-nav__link--active' : ''}`

  const subLinkClass = `mobile-nav__link mobile-nav__link--sub ${FOCUS_RING}`

  return (
    <div className="md:hidden">
      <button
        ref={triggerRef}
        type="button"
        className={`mobile-nav__toggle ${FOCUS_RING}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mobile-nav__toggle-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              data-mobile-nav-keep=""
              className="mobile-nav__backdrop"
              aria-label="Close menu"
              tabIndex={-1}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={close}
            />
            <motion.div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-label="Site navigation"
              className="mobile-nav__panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            >
              <div className="mobile-nav__header">
                <p className="mobile-nav__title">{portfolio.identity.name.split(' ')[0]}.</p>
                <button
                  type="button"
                  className={`mobile-nav__toggle ${FOCUS_RING}`}
                  aria-expanded
                  aria-label="Close menu"
                  onClick={close}
                >
                  <span className="mobile-nav__toggle-icon" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                </button>
              </div>

              <p className="mobile-nav__section-label">Projects</p>
              <ul className="mobile-nav__links">
                <li>
                  {isHome ? (
                    <button
                      type="button"
                      className={linkClass(isHome && activeId === 'projects')}
                      onClick={() => goSection('projects')}
                    >
                      All projects
                    </button>
                  ) : (
                    <Link to="/#projects" className={linkClass(false)} onClick={close}>
                      All projects
                    </Link>
                  )}
                </li>
                {getProjectsByGroup('selected').map((p) => (
                  <li key={p.slug}>
                    <Link to={`/projects/${p.slug}`} className={subLinkClass} onClick={close}>
                      {p.title}
                    </Link>
                  </li>
                ))}
                <li>
                  <span className="mobile-nav__section-label" style={{ marginTop: '0.75rem' }}>
                    Other
                  </span>
                </li>
                {getProjectsByGroup('other').map((p) => (
                  <li key={p.slug}>
                    <Link to={`/projects/${p.slug}`} className={subLinkClass} onClick={close}>
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="mobile-nav__section-label">Research</p>
              <ul className="mobile-nav__links">
                <li>
                  {isHome ? (
                    <button
                      type="button"
                      className={linkClass(isHome && activeId === 'research')}
                      onClick={() => goSection('research')}
                    >
                      All research
                    </button>
                  ) : (
                    <Link to="/#research" className={linkClass(false)} onClick={close}>
                      All research
                    </Link>
                  )}
                </li>
                {RESEARCH_SHOWCASE.map((entry) => {
                  const paper = getResearchShowcasePaper(entry.paperSlug)
                  if (!paper) return null
                  const label = RESEARCH_NAV_LABELS[entry.id] ?? paper.title
                  return (
                    <li key={entry.id}>
                      {isHome ? (
                        <button
                          type="button"
                          title={paper.title}
                          className={subLinkClass}
                          onClick={() => goResearchEntry(entry.id)}
                        >
                          {label}
                        </button>
                      ) : (
                        <Link
                          to={`/#${entry.id}`}
                          title={paper.title}
                          className={subLinkClass}
                          onClick={close}
                        >
                          {label}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>

              <p className="mobile-nav__section-label">More</p>
              <ul className="mobile-nav__links">
                <li>
                  <Link
                    to="/ism"
                    className={linkClass(
                      isHome ? activeId === 'ism' : location.pathname.startsWith('/ism'),
                    )}
                    onClick={close}
                  >
                    ISM
                  </Link>
                </li>
                {BIO_SECTIONS.map((id) => {
                  const href = sectionHref(id)
                  const isActive = isHome && activeId === id
                  return (
                    <li key={id}>
                      {href ? (
                        <Link to={href} className={linkClass(false)} onClick={close}>
                          {SECTION_LABELS[id]}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className={linkClass(isActive)}
                          onClick={() => goSection(id)}
                        >
                          {SECTION_LABELS[id]}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>

              <div className="mobile-nav__connect">
                {isHome ? (
                  <button
                    type="button"
                    className={`mobile-nav__connect-btn ${FOCUS_RING}`}
                    onClick={() => goSection('contact')}
                  >
                    Connect
                  </button>
                ) : (
                  <Link
                    to="/#contact"
                    className={`mobile-nav__connect-btn ${FOCUS_RING}`}
                    onClick={close}
                  >
                    Connect
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
