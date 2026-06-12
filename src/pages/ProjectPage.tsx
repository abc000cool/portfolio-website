import { Link, Navigate, useParams } from 'react-router-dom'
import { getProjectBySlug, projectPages, resolveProjectSlug } from '../data/projectPages'
import { SubpageShell } from '../components/layout/SubpageShell'
import { MissionPatch } from '../components/ui/MissionPatch'

export function ProjectPage() {
  const { slug } = useParams<{ slug: string }>()

  if (slug && slug !== resolveProjectSlug(slug)) {
    return <Navigate to={`/projects/${resolveProjectSlug(slug)}`} replace />
  }

  const project = slug ? getProjectBySlug(slug) : undefined

  if (!project) {
    return <Navigate to="/" replace />
  }

  const index = projectPages.findIndex((p) => p.slug === slug)
  const prev = index > 0 ? projectPages[index - 1] : null
  const next = index < projectPages.length - 1 ? projectPages[index + 1] : null

  return (
    <SubpageShell backLabel="Back to projects" backTo="/#projects">
      <article className="max-w-4xl mx-auto">
        <header className="mb-12">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-indigo-300/90">
              {project.category}
            </span>
            {project.status && <span className="tag-badge text-[10px]">{project.status}</span>}
          </div>

          <div className="flex items-start gap-5 mb-6">
            <MissionPatch title={project.title} colors={project.patchColors} size={72} />
            <div>
              <h1 className="font-display text-4xl md:text-5xl text-white m-0 mb-2 tracking-tight">
                {project.title}
              </h1>
              {project.subtitle && (
                <p className="text-sm text-slate-400 m-0 font-mono leading-relaxed">
                  {project.subtitle}
                </p>
              )}
            </div>
          </div>

          <p className="text-lg text-slate-300 leading-relaxed">{project.tagline}</p>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            {project.tags.map((tag) => (
              <span key={tag} className="tag-badge">
                {tag}
              </span>
            ))}
            {project.externalUrl && (
              <a
                href={project.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="link-underline text-sm text-indigo-300 font-medium"
              >
                Visit live site →
              </a>
            )}
          </div>
        </header>

        <section className="glass-card p-6 md:p-8 mb-10">
          <h2 className="font-display text-xl text-white mb-4">Project overview</h2>
          <p className="text-slate-400 leading-relaxed m-0">{project.overview}</p>
        </section>

        {project.specs && (
          <section className="mb-10">
            <h2 className="font-display text-xl text-white mb-5">Technical specifications</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {project.specs.map((spec) => (
                <div key={spec.label} className="glass-card p-4">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500 m-0 mb-1">
                    {spec.label}
                  </p>
                  <p className="text-white font-medium m-0">{spec.value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {project.sections.length > 0 && (
          <section className="mb-10">
            <h2 className="font-display text-xl text-white mb-5">
              {project.slug === 'stratos' ? 'Four integrated subsystems' : 'Key areas'}
            </h2>
            <div className="space-y-4">
              {project.sections.map((section) => (
                <article key={section.title} className="glass-card p-6 md:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h3 className="font-display text-lg text-white m-0">{section.title}</h3>
                    {section.status && (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400/90">
                        {section.status}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 leading-relaxed m-0">{section.description}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {project.capabilities && (
          <section className="mb-10">
            <h2 className="font-display text-xl text-white mb-5">Comprehensive capabilities</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {project.capabilities.map((cap) => (
                <div key={cap.title} className="glass-card p-6">
                  <h3 className="font-display text-base text-white mb-3">{cap.title}</h3>
                  <ul className="space-y-2 m-0 p-0 list-none">
                    {cap.items.map((item) => (
                      <li key={item} className="text-sm text-slate-400 flex gap-2">
                        <span className="text-indigo-400 shrink-0">▸</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {project.documentation && (
          <section className="mb-12">
            <h2 className="font-display text-xl text-white mb-5">Project documentation</h2>
            <div className="space-y-3">
              {project.documentation.map((doc) => (
                <div key={doc.title} className="glass-card p-5">
                  <h3 className="font-display text-base text-white mb-2">{doc.title}</h3>
                  <p className="text-sm text-slate-400 mb-3">{doc.description}</p>
                  {doc.url && (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-underline text-xs font-medium text-indigo-300"
                    >
                      View PDF →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <nav className="flex flex-wrap justify-between gap-4 pt-8 border-t border-white/[0.06]">
          {prev ? (
            <Link
              to={`/projects/${prev.slug}`}
              className="link-underline text-sm text-indigo-300 no-underline"
            >
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              to={`/projects/${next.slug}`}
              className="link-underline text-sm text-indigo-300 no-underline"
            >
              {next.title} →
            </Link>
          )}
        </nav>
      </article>
    </SubpageShell>
  )
}
