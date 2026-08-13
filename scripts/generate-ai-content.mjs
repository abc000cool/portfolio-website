/**
 * Post-build step (after prerender-meta.mjs): makes the site's full content
 * available to AI assistants, crawlers, and anything else that fetches HTML
 * without executing JavaScript. The SPA renders everything client-side, so a
 * plain fetch used to return only the head metadata.
 *
 * Three outputs, all generated from the same TypeScript data the app renders
 * (src/data/*), so none of it can drift from the visible site:
 *
 * 1. dist/llms.txt       - concise indexed summary (llms.txt convention)
 *    dist/llms-full.txt  - the complete portfolio content in one file
 * 2. A <noscript> block in every prerendered page carrying that page's real
 *    content - visible to no-JS fetchers and browsers, invisible otherwise.
 * 3. schema.org JSON-LD: Person on the homepage, ScholarlyArticle on each
 *    research page, SoftwareSourceCode on each project page.
 *
 * Usage: node scripts/generate-ai-content.mjs [distDir]
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = process.argv[2] ? resolvePath(process.argv[2]) : join(ROOT, 'dist')
const ORIGIN = 'https://www.anshpathak.us'

register('./ts-import.mjs', pathToFileURL(join(ROOT, 'scripts', 'ts-import.mjs')))

const { portfolio } = await import(pathToFileURL(join(ROOT, 'src/data/portfolio.ts')).href)
const { RESEARCH_SHOWCASE } = await import(
  pathToFileURL(join(ROOT, 'src/data/researchShowcase.ts')).href
)
const ismData = await import(pathToFileURL(join(ROOT, 'src/data/ismPages.ts')).href)
const { projectPages } = await import(pathToFileURL(join(ROOT, 'src/data/projectPages.ts')).href)

/* ---------------------------------------------------------------- helpers */

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** DOI mentioned in an abstract, e.g. "10.5281/zenodo.21438122". */
function doiOf(paper) {
  const match = (paper.abstract ?? '').match(/10\.\d{4,9}\/[a-zA-Z0-9._-]+/)
  return match ? match[0].replace(/\.$/, '') : null
}

const showcaseByPaper = new Map(RESEARCH_SHOWCASE.map((c) => [c.paperSlug, c]))

/** Only papers surfaced on the site - hidden entries appear in no generated content. */
const visiblePapers = portfolio.papers.filter((p) => !p.hidden)

function paperLinks(paper) {
  const links = []
  const config = showcaseByPaper.get(paper.slug)
  const external = paper.externalUrl ?? config?.externalUrl
  const github = paper.githubUrl ?? config?.githubUrl
  if (external) links.push(['Live site', external])
  if (github) links.push(['Code', github])
  const doi = doiOf(paper)
  if (doi) links.push(['DOI', `https://doi.org/${doi}`])
  links.push(['Page', `${ORIGIN}/research/${paper.slug}`])
  return links
}

function projectLinks(project) {
  const links = []
  if (project.externalUrl) links.push(['Live site', project.externalUrl])
  if (project.githubUrl) links.push(['Code', project.githubUrl])
  links.push(['Page', `${ORIGIN}/projects/${project.slug}`])
  return links
}

const identity = portfolio.identity

/* ---------------------------------------------------------------- llms.txt */

function buildLlmsTxt() {
  const lines = []
  lines.push(`# ${identity.name} - ${identity.title}`)
  lines.push('')
  lines.push(`> ${identity.tagline}`)
  lines.push('')
  lines.push(
    `${identity.school}, ${identity.location}. Contact: ${identity.email}. ` +
      identity.socials.map((s) => `${s.label}: ${s.url}`).join(' | '),
  )
  lines.push('')
  lines.push(`Complete site content in one file: ${ORIGIN}/llms-full.txt`)
  lines.push('')
  lines.push(`## Research (${visiblePapers.length} papers and preprints)`)
  lines.push('')
  for (const paper of visiblePapers) {
    const blurb = paper.summary ?? paper.abstract
    lines.push(`- [${paper.title}](${ORIGIN}/research/${paper.slug}) (${paper.year}, ${paper.venue}): ${blurb}`)
  }
  lines.push('')
  lines.push('## Projects')
  lines.push('')
  for (const project of projectPages) {
    lines.push(`- [${project.title}](${ORIGIN}/projects/${project.slug}) (${project.category}): ${project.tagline}`)
  }
  lines.push('')
  lines.push('## Awards')
  lines.push('')
  for (const award of portfolio.awards) {
    lines.push(`- ${award.title} (${award.category}): ${award.description}`)
  }
  lines.push('')
  lines.push('## Experience')
  lines.push('')
  for (const exp of portfolio.experiences) {
    lines.push(`- ${exp.role}, ${exp.organization} (${exp.period}, ${exp.type})`)
  }
  lines.push('')
  lines.push('## Independent Study & Mentorship (ISM)')
  lines.push('')
  lines.push(`[${portfolio.ism.programName}](${ORIGIN}/ism): ${portfolio.ism.description}`)
  lines.push('')
  return lines.join('\n')
}

function buildLlmsFullTxt() {
  const lines = []
  const rule = () => lines.push('', '---', '')

  lines.push(`# ${identity.name} - ${identity.title}`)
  lines.push('')
  lines.push(`> ${identity.tagline}`)
  lines.push('')
  lines.push(`School: ${identity.school} | Location: ${identity.location} | Email: ${identity.email}`)
  for (const s of identity.socials) lines.push(`${s.label}: ${s.url}`)
  lines.push('')
  lines.push(`Site: ${ORIGIN} | This file: ${ORIGIN}/llms-full.txt`)

  rule()
  lines.push('## About')
  lines.push('')
  lines.push(portfolio.about.bio)
  lines.push('')
  lines.push(`Mission statement: ${portfolio.about.missionStatement}`)
  lines.push('')
  lines.push('Highlights:')
  for (const h of portfolio.about.highlights) lines.push(`- ${h}`)
  lines.push('')
  lines.push(`Disciplines: ${portfolio.disciplines.join(', ')}`)
  lines.push('')
  lines.push('Key numbers:')
  for (const stat of portfolio.stats) {
    lines.push(`- ${stat.display ?? stat.value ?? ''}${stat.suffix ?? ''} - ${stat.label}`)
  }

  rule()
  lines.push(`## Research (${visiblePapers.length} papers and preprints)`)
  for (const paper of visiblePapers) {
    lines.push('')
    lines.push(`### ${paper.title}`)
    lines.push('')
    lines.push(`${paper.year} - ${paper.venue}`)
    for (const [label, url] of paperLinks(paper)) lines.push(`${label}: ${url}`)
    const config = showcaseByPaper.get(paper.slug)
    if (config?.metrics?.length) {
      lines.push('')
      lines.push('Key results:')
      for (const metric of config.metrics) lines.push(`- ${metric.value} - ${metric.label}`)
    }
    lines.push('')
    lines.push(`Abstract: ${paper.abstract}`)
  }

  rule()
  lines.push('## Projects')
  for (const project of projectPages) {
    lines.push('')
    lines.push(`### ${project.title}${project.subtitle ? ` - ${project.subtitle}` : ''}`)
    lines.push('')
    lines.push(
      `Category: ${project.category}${project.status ? ` | Status: ${project.status}` : ''} | Tags: ${project.tags.join(', ')}`,
    )
    for (const [label, url] of projectLinks(project)) lines.push(`${label}: ${url}`)
    lines.push('')
    lines.push(`${project.tagline}`)
    lines.push('')
    lines.push(project.overview)
    if (project.specs?.length) {
      lines.push('')
      lines.push('Specs:')
      for (const spec of project.specs) lines.push(`- ${spec.label}: ${spec.value}`)
    }
    for (const section of project.sections ?? []) {
      lines.push('')
      lines.push(`#### ${section.title}`)
      lines.push('')
      lines.push(section.description)
      for (const item of section.items ?? []) lines.push(`- ${item}`)
    }
    for (const cap of project.capabilities ?? []) {
      lines.push('')
      lines.push(`#### ${cap.title}`)
      for (const item of cap.items) lines.push(`- ${item}`)
    }
    for (const doc of project.documentation ?? []) {
      lines.push(`Document - ${doc.title}: ${doc.description}${doc.url ? ` (${doc.url})` : ''}`)
    }
  }

  rule()
  lines.push(`## ${portfolio.ism.programName} (ISM) - ${portfolio.ism.district}`)
  lines.push('')
  lines.push(`Focus: ${portfolio.ism.focus}`)
  lines.push('')
  lines.push(portfolio.ism.description)
  lines.push('')
  lines.push(
    `Mentor: ${ismData.ismMentor.name}, ${ismData.ismMentor.title}, ${ismData.ismMentor.organization}`,
  )
  lines.push('')
  lines.push(ismData.ismMentor.bio)
  lines.push('')
  lines.push('Mentorship focus areas:')
  for (const area of ismData.ismMentor.focusAreas) {
    lines.push(`- ${area.title}: ${area.description}`)
  }
  lines.push('')
  lines.push('### ISM Research Assessments')
  for (const a of ismData.ismResearchAssessments) {
    lines.push('')
    lines.push(`${a.number}. ${a.title} (${a.date}) - ${a.description} [${a.tags.join(', ')}]`)
  }
  lines.push('')
  lines.push('### ISM Professional Interviews')
  for (const i of ismData.ismInterviews) {
    lines.push('')
    lines.push(`${i.number}. ${i.name}, ${i.role} (${i.date}): ${i.summary}`)
    for (const insight of i.insights) lines.push(`   - ${insight}`)
  }
  lines.push('')
  lines.push('### Mentor Meetings')
  for (const m of ismData.ismMentorMeetings) {
    lines.push('')
    lines.push(`${m.number}. ${m.title} (${m.date}, ${m.format}): ${m.summary}`)
    for (const t of m.takeaways) lines.push(`   - ${t}`)
  }
  lines.push('')
  lines.push('### Foundational Documents')
  for (const d of ismData.ismFoundationalDocuments) {
    lines.push(`- ${d.title}: ${d.description}`)
  }

  rule()
  lines.push('## Awards & Recognition')
  lines.push('')
  for (const award of portfolio.awards) {
    lines.push(`- ${award.title} (${award.category}): ${award.description}`)
  }

  rule()
  lines.push('## Experience')
  lines.push('')
  for (const exp of portfolio.experiences) {
    lines.push(`### ${exp.role} - ${exp.organization} (${exp.period}, ${exp.type})`)
    lines.push('')
    lines.push(exp.description)
    lines.push('')
  }

  rule()
  lines.push('## Contact')
  lines.push('')
  lines.push(`${portfolio.contact.heading}: ${portfolio.contact.message}`)
  lines.push(`Email: ${identity.email}`)
  for (const s of identity.socials) lines.push(`${s.label}: ${s.url}`)
  lines.push('')
  return lines.join('\n')
}

/* --------------------------------------------------- per-page HTML content */

function linkListHtml(links) {
  return `<ul>${links
    .map(([label, url]) => `<li>${escapeHtml(label)}: <a href="${escapeHtml(url)}">${escapeHtml(url)}</a></li>`)
    .join('')}</ul>`
}

function homeHtml() {
  const parts = []
  parts.push(`<h1>${escapeHtml(identity.name)} - ${escapeHtml(identity.title)}</h1>`)
  parts.push(`<p>${escapeHtml(identity.tagline)}</p>`)
  parts.push(`<p>${escapeHtml(portfolio.about.bio)}</p>`)
  parts.push(
    `<p>${escapeHtml(identity.school)}, ${escapeHtml(identity.location)}. Email: ${escapeHtml(identity.email)}</p>`,
  )
  parts.push(`<h2>Research (${visiblePapers.length} papers and preprints)</h2><ul>`)
  for (const paper of visiblePapers) {
    parts.push(
      `<li><a href="/research/${paper.slug}">${escapeHtml(paper.title)}</a> (${paper.year}, ${escapeHtml(paper.venue)}): ${escapeHtml(paper.summary ?? paper.abstract)}</li>`,
    )
  }
  parts.push('</ul><h2>Projects</h2><ul>')
  for (const project of projectPages) {
    parts.push(
      `<li><a href="/projects/${project.slug}">${escapeHtml(project.title)}</a>: ${escapeHtml(project.tagline)}</li>`,
    )
  }
  parts.push('</ul><h2>Awards</h2><ul>')
  for (const award of portfolio.awards) {
    parts.push(`<li>${escapeHtml(award.title)}: ${escapeHtml(award.description)}</li>`)
  }
  parts.push('</ul><h2>Experience</h2><ul>')
  for (const exp of portfolio.experiences) {
    parts.push(
      `<li>${escapeHtml(exp.role)}, ${escapeHtml(exp.organization)} (${escapeHtml(exp.period)}): ${escapeHtml(exp.description)}</li>`,
    )
  }
  parts.push('</ul>')
  parts.push(`<h2>${escapeHtml(portfolio.ism.programName)}</h2><p>${escapeHtml(portfolio.ism.description)}</p>`)
  parts.push(
    `<p>Full machine-readable content: <a href="/llms.txt">/llms.txt</a> and <a href="/llms-full.txt">/llms-full.txt</a></p>`,
  )
  return parts.join('')
}

function paperHtml(paper) {
  const config = showcaseByPaper.get(paper.slug)
  const parts = []
  parts.push(`<h1>${escapeHtml(paper.title)}</h1>`)
  parts.push(`<p>${escapeHtml(identity.name)} - ${paper.year} - ${escapeHtml(paper.venue)}</p>`)
  parts.push(`<p>${escapeHtml(paper.abstract)}</p>`)
  if (config?.metrics?.length) {
    parts.push(
      `<ul>${config.metrics.map((m) => `<li>${escapeHtml(m.value)} - ${escapeHtml(m.label)}</li>`).join('')}</ul>`,
    )
  }
  parts.push(linkListHtml(paperLinks(paper)))
  return parts.join('')
}

function projectHtml(project) {
  const parts = []
  parts.push(`<h1>${escapeHtml(project.title)}</h1>`)
  parts.push(`<p>${escapeHtml(project.tagline)}</p>`)
  parts.push(`<p>${escapeHtml(project.overview)}</p>`)
  if (project.specs?.length) {
    parts.push(
      `<ul>${project.specs.map((s) => `<li>${escapeHtml(s.label)}: ${escapeHtml(s.value)}</li>`).join('')}</ul>`,
    )
  }
  parts.push(linkListHtml(projectLinks(project)))
  return parts.join('')
}

function ismHtml(section) {
  const parts = []
  parts.push(`<h1>${escapeHtml(portfolio.ism.programName)}</h1>`)
  parts.push(`<p>${escapeHtml(portfolio.ism.description)}</p>`)
  if (!section || section === 'mentorship') {
    parts.push(
      `<p>Mentor: ${escapeHtml(ismData.ismMentor.name)}, ${escapeHtml(ismData.ismMentor.title)}, ${escapeHtml(ismData.ismMentor.organization)}. ${escapeHtml(ismData.ismMentor.bio)}</p>`,
    )
  }
  if (!section || section === 'research') {
    parts.push('<h2>Research Assessments</h2><ul>')
    for (const a of ismData.ismResearchAssessments) {
      parts.push(`<li>${escapeHtml(a.title)} (${escapeHtml(a.date)}): ${escapeHtml(a.description)}</li>`)
    }
    parts.push('</ul>')
  }
  if (!section || section === 'interviews') {
    parts.push('<h2>Professional Interviews</h2><ul>')
    for (const i of ismData.ismInterviews) {
      parts.push(`<li>${escapeHtml(i.name)}, ${escapeHtml(i.role)} (${escapeHtml(i.date)}): ${escapeHtml(i.summary)}</li>`)
    }
    parts.push('</ul>')
  }
  return parts.join('')
}

/* ----------------------------------------------------------------- JSON-LD */

function personJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: identity.name,
    url: ORIGIN,
    email: identity.email,
    description: identity.tagline,
    affiliation: { '@type': 'EducationalOrganization', name: identity.school },
    address: { '@type': 'PostalAddress', addressLocality: 'Frisco', addressRegion: 'TX' },
    knowsAbout: portfolio.disciplines,
    sameAs: identity.socials.filter((s) => s.url.startsWith('http')).map((s) => s.url),
  }
}

function paperJsonLd(paper) {
  const doi = doiOf(paper)
  const config = showcaseByPaper.get(paper.slug)
  const sameAs = [paper.externalUrl ?? config?.externalUrl, paper.githubUrl ?? config?.githubUrl]
  if (doi) sameAs.push(`https://doi.org/${doi}`)
  return {
    '@context': 'https://schema.org',
    '@type': 'ScholarlyArticle',
    headline: paper.title,
    abstract: paper.abstract,
    datePublished: String(paper.year),
    author: { '@type': 'Person', name: identity.name, url: ORIGIN },
    url: `${ORIGIN}/research/${paper.slug}`,
    ...(doi ? { identifier: { '@type': 'PropertyValue', propertyID: 'DOI', value: doi } } : {}),
    sameAs: sameAs.filter(Boolean),
  }
}

function projectJsonLd(project) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: project.title,
    description: project.tagline,
    author: { '@type': 'Person', name: identity.name, url: ORIGIN },
    url: `${ORIGIN}/projects/${project.slug}`,
    ...(project.githubUrl ? { codeRepository: project.githubUrl } : {}),
  }
}

/* --------------------------------------------------------------- injection */

function inject(filePath, noscriptHtml, jsonLd) {
  let html = readFileSync(filePath, 'utf8')
  if (html.includes('id="ai-fallback"')) return false

  if (jsonLd) {
    const script = `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`
    html = html.replace(/<\/head>/i, `    ${script}\n  </head>`)
  }
  if (noscriptHtml) {
    html = html.replace(
      '<div id="root"></div>',
      `<div id="root"></div>\n    <noscript><div id="ai-fallback">${noscriptHtml}</div></noscript>`,
    )
  }
  writeFileSync(filePath, html, 'utf8')
  return true
}

function* htmlFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory() && entry.name !== 'assets') yield* htmlFiles(full)
    else if (entry.name === 'index.html') yield full
  }
}

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`generate-ai-content: ${join(DIST, 'index.html')} not found - run the build first.`)
  process.exit(1)
}

const llmsTxt = buildLlmsTxt()
const llmsFullTxt = buildLlmsFullTxt()
writeFileSync(join(DIST, 'llms.txt'), llmsTxt, 'utf8')
writeFileSync(join(DIST, 'llms-full.txt'), llmsFullTxt, 'utf8')

const papersBySlug = new Map(visiblePapers.map((p) => [p.slug, p]))
const projectsBySlug = new Map(projectPages.map((p) => [p.slug, p]))

let injected = 0
for (const file of htmlFiles(DIST)) {
  const route = file
    .slice(DIST.length)
    .replace(/\\/g, '/')
    .replace(/\/index\.html$/, '')

  let done = false
  if (route === '') {
    done = inject(file, homeHtml(), personJsonLd())
  } else if (route.startsWith('/research/')) {
    const paper = papersBySlug.get(route.split('/')[2])
    if (paper) done = inject(file, paperHtml(paper), paperJsonLd(paper))
  } else if (route.startsWith('/projects/')) {
    const project = projectsBySlug.get(route.split('/')[2])
    if (project) done = inject(file, projectHtml(project), projectJsonLd(project))
  } else if (route === '/ism') {
    done = inject(file, ismHtml(), null)
  } else if (route.startsWith('/ism/')) {
    done = inject(file, ismHtml(route.split('/')[2]), null)
  }
  if (done) injected++
}

console.log(
  `generate-ai-content: wrote llms.txt (${llmsTxt.length} chars), llms-full.txt (${llmsFullTxt.length} chars), injected ${injected} pages`,
)
