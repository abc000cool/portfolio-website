import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { portfolio, SECTION_IDS, SECTION_LABELS, type SectionId } from '../../data/portfolio'
import { getProjectsByGroup } from '../../data/projectPages'
import { scrollToSection } from '../../lib/lenis'
import { MobileNav } from './MobileNav'

const HOME_SECTIONS = SECTION_IDS.filter(
  (id) => id !== 'intro' && id !== 'hero' && id !== 'projects' && id !== 'ism',
)

function NavDropdown({
  label,
  isActive,
  children,
}: {
  label: string
  isActive: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLLIElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <li ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        aria-expanded={open}
        className={`relative z-10 px-3.5 py-1.5 text-[13px] font-medium bg-transparent border-none cursor-pointer transition-colors duration-300 rounded-full flex items-center gap-1 ${
          isActive ? 'text-white' : 'text-slate-400 hover:text-white'
        }`}
      >
        {label}
        <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-60">
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
          className="absolute top-full left-0 mt-2 min-w-[13rem] py-2 list-none m-0 rounded-xl border border-white/10 bg-[rgba(8,8,14,0.95)] backdrop-blur-xl shadow-2xl z-50"
          onMouseLeave={() => setOpen(false)}
        >
          {children}
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

    const onScroll = () => {
      setScrolled(window.scrollY > 24)

      const probe = window.scrollY + window.innerHeight * 0.4
      let current: string = SECTION_IDS[0]
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id)
        if (!el) continue
        const top = el.getBoundingClientRect().top + window.scrollY
        if (top <= probe) current = id
      }
      setActiveId(current)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isHome])

  const navSolid = !isHome || scrolled

  const goSection = (id: SectionId) => {
    if (isHome) scrollToSection(id)
  }

  const projectsActive = isHome ? activeId === 'projects' : location.pathname.startsWith('/projects')
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

        <ul className="hidden md:flex gap-0.5 list-none m-0 p-0 relative items-center">
          {HOME_SECTIONS.map((id) => {
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

          <NavDropdown label="Projects" isActive={projectsActive}>
            <li>
              {isHome ? (
                <button
                  type="button"
                  onClick={() => scrollToSection('projects')}
                  className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/[0.05] bg-transparent border-none cursor-pointer"
                >
                  All projects
                </button>
              ) : (
                <Link
                  to="/#projects"
                  className="block px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/[0.05] no-underline"
                >
                  All projects
                </Link>
              )}
            </li>
            {getProjectsByGroup('selected').map((p) => (
              <li key={p.slug}>
                <Link
                  to={`/projects/${p.slug}`}
                  className="block px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/[0.05] no-underline"
                >
                  {p.title}
                </Link>
              </li>
            ))}
            <li className="px-4 pt-2 pb-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Other projects
              </span>
            </li>
            {getProjectsByGroup('other').map((p) => (
              <li key={p.slug}>
                <Link
                  to={`/projects/${p.slug}`}
                  className="block px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/[0.05] no-underline"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </NavDropdown>

          <li className="relative">
            <Link
              to="/ism"
              className={`${linkClass(ismActive)} ${ismActive && isHome ? '' : ''}`}
            >
              ISM
            </Link>
            {ismActive && isHome && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 rounded-full bg-white/[0.08] border border-white/10 pointer-events-none"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
          </li>
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
