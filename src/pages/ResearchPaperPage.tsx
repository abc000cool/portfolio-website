import { Link, Navigate, useParams } from 'react-router-dom'
import { getPaperBySlug, portfolio } from '../data/portfolio'
import { SubpageShell } from '../components/layout/SubpageShell'

export function ResearchPaperPage() {
  const { slug } = useParams<{ slug: string }>()
  const paper = slug ? getPaperBySlug(slug) : undefined

  if (!paper) {
    return <Navigate to="/" replace />
  }

  const index = portfolio.papers.findIndex((p) => p.slug === slug)
  const prev = index > 0 ? portfolio.papers[index - 1] : null
  const next = index < portfolio.papers.length - 1 ? portfolio.papers[index + 1] : null

  return (
    <SubpageShell backLabel="Back to research" backTo="/#research">
      <article className="max-w-4xl mx-auto">
        <header className="mb-10">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-indigo-300/90 mb-3">
            Pending Research
          </p>
          <p className="font-mono text-sm text-amber-200/80 m-0 mb-4">
            {paper.year} — {paper.venue}
          </p>
          <h1 className="font-display text-3xl md:text-4xl lg:text-[2.35rem] text-white m-0 leading-snug tracking-tight">
            {paper.title}
          </h1>
        </header>

        <section className="glass-card p-6 md:p-8 mb-10">
          <h2 className="font-display text-xl text-white mb-4">Abstract</h2>
          <div className="text-slate-300 leading-relaxed text-base md:text-lg">
            {paper.abstractHtml ? (
              <p dangerouslySetInnerHTML={{ __html: paper.abstractHtml }} className="m-0" />
            ) : (
              <p className="m-0">{paper.abstract}</p>
            )}
          </div>
        </section>

        <nav className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-white/[0.06]">
          {prev ? (
            <Link
              to={`/research/${prev.slug}`}
              className="link-underline text-sm text-slate-400 hover:text-white no-underline"
            >
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              to={`/research/${next.slug}`}
              className="link-underline text-sm text-slate-400 hover:text-white no-underline text-right"
            >
              {next.title} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </article>
    </SubpageShell>
  )
}
