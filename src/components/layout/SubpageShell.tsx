import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { portfolio } from '../../data/portfolio'
import { externalLinkRel } from '../../lib/externalLink'
import { Starfield } from './Starfield'
import { AtmosphereDescent } from './AtmosphereDescent'
import { SiteNav } from './SiteNav'
import { CustomCursor } from './CustomCursor'

export function SubpageShell({
  children,
  backLabel = 'Back to mission',
  backTo = '/',
}: {
  children: ReactNode
  backLabel?: string
  backTo?: string
}) {
  return (
    <>
      <Starfield />
      <AtmosphereDescent />
      <CustomCursor />
      <SiteNav />

      <main className="relative z-10 min-h-screen pt-28 pb-20 px-[clamp(1.5rem,5vw,4rem)]">
        <div className="max-w-4xl mx-auto mb-10">
          <Link
            to={backTo}
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-slate-500 hover:text-indigo-300 transition-colors no-underline"
          >
            ← {backLabel}
          </Link>
        </div>
        {children}
      </main>

      <footer className="relative z-10 py-12 px-6 border-t border-white/[0.05]">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500 m-0">
            © {new Date().getFullYear()} {portfolio.identity.name}
          </p>
          <div className="flex items-center gap-6">
            {portfolio.identity.socials.map((s) => (
              <a
                key={s.label}
                href={s.url}
                rel={externalLinkRel(s.url)}
                className="link-underline text-sm text-slate-400"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </>
  )
}
