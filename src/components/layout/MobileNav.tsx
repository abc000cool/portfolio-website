import { useCallback, useEffect, useId, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { portfolio, SECTION_IDS, SECTION_LABELS, type SectionId } from '../../data/portfolio'
import { getProjectsByGroup } from '../../data/projectPages'
import { scrollToSection } from '../../lib/lenis'

const HOME_SECTIONS = SECTION_IDS.filter(
  (id) => id !== 'intro' && id !== 'hero' && id !== 'projects' && id !== 'ism',
)

interface MobileNavProps {
  isHome: boolean
  activeId: string
}

export function MobileNav({ isHome, activeId }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const location = useLocation()

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    close()
  }, [location.pathname, location.hash, close])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  const goSection = (id: SectionId) => {
    if (isHome) scrollToSection(id)
    close()
  }

  const sectionHref = (id: SectionId) => (isHome ? undefined : `/#${id}`)

  const linkClass = (active: boolean) =>
    `mobile-nav__link${active ? ' mobile-nav__link--active' : ''}`

  return (
    <div className="md:hidden">
      <button
        type="button"
        className="mobile-nav__toggle"
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
              className="mobile-nav__backdrop"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={close}
            />
            <motion.div
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
                  className="mobile-nav__toggle"
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

              <p className="mobile-nav__section-label">Sections</p>
              <ul className="mobile-nav__links">
                {HOME_SECTIONS.map((id) => {
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
                    <Link
                      to={`/projects/${p.slug}`}
                      className="mobile-nav__link mobile-nav__link--sub"
                      onClick={close}
                    >
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
                    <Link
                      to={`/projects/${p.slug}`}
                      className="mobile-nav__link mobile-nav__link--sub"
                      onClick={close}
                    >
                      {p.title}
                    </Link>
                  </li>
                ))}
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
              </ul>

              <div className="mobile-nav__connect">
                {isHome ? (
                  <button
                    type="button"
                    className="mobile-nav__connect-btn"
                    onClick={() => goSection('contact')}
                  >
                    Connect
                  </button>
                ) : (
                  <Link to="/#contact" className="mobile-nav__connect-btn" onClick={close}>
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
