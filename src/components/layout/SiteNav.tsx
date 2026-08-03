import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { portfolio, SECTION_IDS, SECTION_LABELS, type SectionId } from '../../data/portfolio'
import { getProjectsByGroup } from '../../data/projectPages'
import { RESEARCH_SHOWCASE, getResearchShowcasePaper } from '../../data/researchShowcase'
import { scrollToSection } from '../../lib/lenis'
import { MobileNav } from './MobileNav'

/**
 * Biography sections, shown after the work. Contact is deliberately absent -
 * the Connect button on the right is the contact affordance and a second
 * "Contact" link next to it is noise.
 */
const BIO_SECTIONS: SectionId[] = ['about', 'stats']

/**
 * Short nav labels for the research entries. Full paper titles run to twenty
 * words; these are the condensed forms already used in the Research section
 * intro copy (src/sections/ResearchSection.tsx). The full title is still
 * exposed as the link's `title`.
 */
const RESEARCH_NAV_LABELS: Record<string, string> = {
  'research-debris': 'Orbital debris mitigation',
  'research-airfoil': 'Morphing airfoil optimization',
  'research-flowstate': 'Fluid-dynamics traffic modeling',
  'research-qcin': 'Hybrid quantum–classical inertial navigation',
  'research-sailnko': 'Solar-sail non-Keplerian orbits',
  'research-transition': 'Boundary-layer transition prediction',
}

const DROPDOWN_ITEM =
  'block w-full text-left px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/[0.05] focus-visible:text-white focus-visible:bg-white/[0.08] focus-visible:shadow-[inset_0_0_0_2px_#818cf8] no-underline bg-transparent border-none cursor-pointer'

const DROPDOWN_ITEM_LEAD =
  'block w-full text-left px-4 py-2 text-sm text-slate-200 hover:text-white hover:bg-white/[0.05] focus-visible:text-white focus-visible:bg-white/[0.08] focus-visible:shadow-[inset_0_0_0_2px_#818cf8] no-underline bg-transparent border-none cursor-pointer'

const DROPDOWN_GROUP_LABEL = 'font-mono text-[10px] uppercase tracking-wider text-slate-500'

function NavDropdown({
  label,
  isActive,
  menuClassName = 'min-w-[13rem]',
  children,
}: {
  label: string
  isActive: boolean
  menuClassName?: string
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLLIElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <li
      ref={ref}
      className="relative"
      onBlur={(e) => {
        // Only close when focus actually lands somewhere else (keyboard
        // tab-out). A null relatedTarget also fires when Safari blurs on
        // mousedown, and closing there would unmount the item before its
        // click ever dispatches. Outside clicks are handled above.
        const next = e.relatedTarget as Node | null
        if (next && !e.currentTarget.contains(next)) setOpen(false)
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`relative z-10 px-3.5 py-1.5 text-[13px] font-medium bg-transparent border-none cursor-pointer transition-colors duration-300 rounded-full flex items-center gap-1 ${
          isActive ? 'text-white' : 'text-slate-400 hover:text-white'
        }`}
      >
        {label}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden="true"
          className={`opacity-60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 4 L5 7 L8 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>
      {isActive && (
        <motion.span
          layoutId="nav-pill"
          className="absolute inset-0 rounded-full bg-white/[0.08] border border-white/10 pointer-events-none"
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      )}
      {open && (
        <ul
          className={`absolute top-full left-0 mt-2 py-2 list-none m-0 rounded-xl border border-white/10 bg-[rgba(8,8,14,0.95)] backdrop-blur-xl shadow-2xl z-50 max-h-[70vh] overflow-y-auto ${menuClassName}`}
          onMouseLeave={close}
        >
          {children(close)}
        </ul>
      )}
    </li>
  )
}

function sectionHref(id: SectionId, isHome: boolean) {
  return isHome ? undefined : `/#${id}`
}

export function SiteNav() {
  const location = useLocation()
  const isHome = location.pathname === '/'
  const [scrolled, setScrolled] = useState(false)
  const [activeId, setActiveId] = useState<string>('intro')

  useEffect(() => {
    if (!isHome) return

    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const y = window.scrollY
        setScrolled(y > 24)

        const probe = y + window.innerHeight * 0.4
        let current: string = SECTION_IDS[0]
        for (const id of SECTION_IDS) {
          const el = document.getElementById(id)
          if (!el) continue
          const top = el.getBoundingClientRect().top + y
          if (top <= probe) current = id
        }
        setActiveId(current)
      })
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [isHome])

  const navSolid = !isHome || scrolled

  const goSection = (id: SectionId) => {
    if (isHome) scrollToSection(id)
  }

  /**
   * Research entries render as cards without per-entry ids below the 1024px
   * layout breakpoint, while this nav is visible from 768px up. Fall back to
   * the section itself rather than doing nothing.
   */
  const goResearchEntry = (id: string) => {
    scrollToSection(document.getElementById(id) ? id : 'research')
  }

  const projectsActive = isHome ? activeId === 'projects' : location.pathname.startsWith('/projects')
  const researchActive = isHome ? activeId === 'research' : location.pathname.startsWith('/research')
  const ismActive = isHome ? activeId === 'ism' : location.pathname.startsWith('/ism')

  const linkClass = (active: boolean) =>
    `relative z-10 px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-300 rounded-full no-underline ${
      active ? 'text-white' : 'text-slate-400 hover:text-white'
    }`

  return (
    <motion.nav
      initial={{ y: -56, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        navSolid
          ? 'py-2.5 bg-[rgba(6,6,10,0.7)] backdrop-blur-2xl border-b border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.35)]'
          : 'py-5 bg-transparent'
      }`}
      aria-label="Main navigation"
    >
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
        {isHome ? (
          <button
            type="button"
            onClick={() => scrollToSection('intro')}
            className="font-display text-base font-semibold text-white bg-transparent border-none cursor-pointer tracking-tight"
          >
            {portfolio.identity.name.split(' ')[0]}
            <span className="text-indigo-400">.</span>
          </button>
        ) : (
          <Link
            to="/"
            className="font-display text-base font-semibold text-white no-underline tracking-tight"
          >
            {portfolio.identity.name.split(' ')[0]}
            <span className="text-indigo-400">.</span>
          </Link>
        )}

        {/* Work first, biography after - the reader is here for the work. */}
        <ul className="hidden md:flex gap-0.5 list-none m-0 p-0 relative items-center">
          <NavDropdown label="Projects" isActive={projectsActive}>
            {(close) => (
              <>
                <li>
                  {isHome ? (
                    <button
                      type="button"
                      onClick={() => {
                        close()
                        scrollToSection('projects')
                      }}
                      className={DROPDOWN_ITEM_LEAD}
                    >
                      All projects
                    </button>
                  ) : (
                    <Link to="/#projects" className={DROPDOWN_ITEM_LEAD} onClick={close}>
                      All projects
                    </Link>
                  )}
                </li>
                {getProjectsByGroup('selected').map((p) => (
                  <li key={p.slug}>
                    <Link to={`/projects/${p.slug}`} className={DROPDOWN_ITEM} onClick={close}>
                      {p.title}
                    </Link>
                  </li>
                ))}
                <li className="px-4 pt-2 pb-1">
                  <span className={DROPDOWN_GROUP_LABEL}>Other projects</span>
                </li>
                {getProjectsByGroup('other').map((p) => (
                  <li key={p.slug}>
                    <Link to={`/projects/${p.slug}`} className={DROPDOWN_ITEM} onClick={close}>
                      {p.title}
                    </Link>
                  </li>
                ))}
              </>
            )}
          </NavDropdown>

          <NavDropdown
            label="Research"
            isActive={researchActive}
            menuClassName="min-w-[19rem] max-w-[22rem]"
          >
            {(close) => (
              <>
                <li>
                  {isHome ? (
                    <button
                      type="button"
                      onClick={() => {
                        close()
                        scrollToSection('research')
                      }}
                      className={DROPDOWN_ITEM_LEAD}
                    >
                      All research
                    </button>
                  ) : (
                    <Link to="/#research" className={DROPDOWN_ITEM_LEAD} onClick={close}>
                      All research
                    </Link>
                  )}
                </li>
                {RESEARCH_SHOWCASE.map((entry) => {
                  const paper = getResearchShowcasePaper(entry.paperSlug)
                  if (!paper) return null
                  const label = RESEARCH_NAV_LABELS[entry.id] ?? paper.title
                  const body = (
                    <>
                      <span className="block leading-snug">{label}</span>
                      <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">
                        {paper.year} · {paper.venue}
                      </span>
                    </>
                  )
                  return (
                    <li key={entry.id}>
                      {isHome ? (
                        <button
                          type="button"
                          title={paper.title}
                          onClick={() => {
                            close()
                            goResearchEntry(entry.id)
                          }}
                          className={DROPDOWN_ITEM}
                        >
                          {body}
                        </button>
                      ) : (
                        <Link
                          to={`/#${entry.id}`}
                          title={paper.title}
                          className={DROPDOWN_ITEM}
                          onClick={close}
                        >
                          {body}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </>
            )}
          </NavDropdown>

          <li className="relative">
            <Link to="/ism" className={linkClass(ismActive)}>
              ISM
            </Link>
            {ismActive && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 rounded-full bg-white/[0.08] border border-white/10 pointer-events-none"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
          </li>

          {BIO_SECTIONS.map((id) => {
            const isActive = isHome && activeId === id
            const href = sectionHref(id, isHome)
            return (
              <li key={id} className="relative">
                {href ? (
                  <Link to={href} className={linkClass(false)}>
                    {SECTION_LABELS[id]}
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => goSection(id)}
                      className={`${linkClass(isActive)} bg-transparent border-none cursor-pointer`}
                    >
                      {SECTION_LABELS[id]}
                    </button>
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-full bg-white/[0.08] border border-white/10 pointer-events-none"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    )}
                  </>
                )}
              </li>
            )
          })}
        </ul>

        <div className="flex items-center gap-2">
          {isHome ? (
            <button
              type="button"
              onClick={() => scrollToSection('contact')}
              className="hidden md:inline-flex items-center px-4 py-1.5 text-[13px] font-medium text-slate-900 bg-white rounded-full border-none cursor-pointer hover:bg-indigo-100 transition-colors"
            >
              Connect
            </button>
          ) : (
            <Link
              to="/#contact"
              className="hidden md:inline-flex items-center px-4 py-1.5 text-[13px] font-medium text-slate-900 bg-white rounded-full no-underline hover:bg-indigo-100 transition-colors"
            >
              Connect
            </Link>
          )}
          <MobileNav isHome={isHome} activeId={activeId} />
        </div>
      </div>
    </motion.nav>
  )
}
