#!/usr/bin/env node
/**
 * Post-build step: writes a real HTML file for every deep route so that link
 * unfurlers (iMessage, Slack, LinkedIn, X, Google) get per-page <title>,
 * description, og:* and canonical instead of the single homepage head.
 *
 * Vercel serves a matching static file before applying the SPA rewrite in
 * vercel.json, so dist/projects/stratos/index.html is what a crawler receives at
 * /projects/stratos, while the React app still takes over routing on the client.
 *
 * Zero dependencies by design: slugs and copy are parsed straight out of the
 * TypeScript sources so this can never drift into inventing content.
 *
 * Usage: node scripts/prerender-meta.mjs [distDir]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = process.argv[2] ? resolve(process.argv[2]) : join(ROOT, 'dist')
const ORIGIN = 'https://www.anshpathak.us'

/* ------------------------------------------------------------------ parsing */

/** Matches a single-, double- or backtick-quoted JS string literal. */
const STRING = String.raw`'(?:[^'\\]|\\[\s\S])*'|"(?:[^"\\]|\\[\s\S])*"|\`(?:[^\`\\]|\\[\s\S])*\``

const ESCAPES = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' }

function decodeLiteral(raw) {
  const body = raw.slice(1, -1)
  return body.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\r?\n|[\s\S])/g, (_, esc) => {
    if (esc.startsWith('u{')) return String.fromCodePoint(parseInt(esc.slice(2, -1), 16))
    if (esc.startsWith('u')) return String.fromCharCode(parseInt(esc.slice(1), 16))
    if (esc.startsWith('x')) return String.fromCharCode(parseInt(esc.slice(1), 16))
    if (esc === '\n' || esc === '\r\n') return ''
    return ESCAPES[esc] ?? esc
  })
}

/** First `key: '...'` string value inside a source block. */
function field(block, key) {
  const match = block.match(new RegExp(`(?:^|[\\s{,;])${key}:\\s*(${STRING})`))
  return match ? decodeLiteral(match[1]) : null
}

/** Split a source file into one block per `slug: '...'` entry. */
function entriesBySlug(source) {
  const marks = [...source.matchAll(/\bslug:\s*'([^']+)'/g)]
  return marks.map((mark, i) => ({
    slug: mark[1],
    block: source.slice(mark.index, i + 1 < marks.length ? marks[i + 1].index : source.length),
  }))
}

/** Slice from `marker` up to the first line that closes it at `closer`. */
function objectBlock(source, marker, closer) {
  const start = source.indexOf(marker)
  if (start === -1) return null
  const end = source.indexOf(closer, start + marker.length)
  return source.slice(start, end === -1 ? source.length : end)
}

function read(relPath) {
  return readFileSync(join(ROOT, relPath), 'utf8')
}

/* ------------------------------------------------------------------- shared */

/** Mirror of clampText() in src/hooks/useDocumentHead.ts - keep both in sync. */
function clampText(text, max) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  const trimmed = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut
  // Hyphen last so it is a literal, not a range endpoint.
  return `${trimmed.replace(/[\s,;:.–-]+$/, '')}…`
}

function escapeAttr(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeXml(value) {
  return escapeAttr(value).replace(/'/g, '&apos;')
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/* -------------------------------------------------------------- route table */

const projectSource = read('src/data/projectPages.ts')
const portfolioSource = read('src/data/portfolio.ts')
const ismPageSource = read('src/pages/IsmPage.tsx')

const identity = objectBlock(portfolioSource, 'identity: {', '\n  },')
const author = identity && field(identity, 'name')
if (!author) throw new Error('prerender-meta: could not read identity.name from src/data/portfolio.ts')

const routes = []

// Projects - /projects/<slug>
const projects = entriesBySlug(projectSource)
if (projects.length === 0) {
  throw new Error('prerender-meta: no project slugs parsed from src/data/projectPages.ts')
}
for (const { slug, block } of projects) {
  const title = field(block, 'title')
  const tagline = field(block, 'tagline')
  if (!title || !tagline) {
    throw new Error(`prerender-meta: missing title/tagline for project "${slug}"`)
  }
  routes.push({
    path: `/projects/${slug}`,
    title: `${title} - ${author}`,
    description: clampText(tagline, 160),
  })
}

// Research papers - /research/<slug>
const papers = entriesBySlug(portfolioSource)
if (papers.length === 0) {
  throw new Error('prerender-meta: no paper slugs parsed from src/data/portfolio.ts')
}
for (const { slug, block } of papers) {
  // Hidden papers stay in the data but get no prerendered page or sitemap entry.
  if (/\bhidden:\s*true\b/.test(block)) continue
  const title = field(block, 'title')
  const abstract = field(block, 'abstract')
  if (!title || !abstract) {
    throw new Error(`prerender-meta: missing title/abstract for paper "${slug}"`)
  }
  routes.push({
    path: `/research/${slug}`,
    title: `${clampText(title, 80)} - ${author}`,
    description: clampText(abstract, 160),
  })
}

// ISM overview - /ism
const ism = objectBlock(portfolioSource, 'ism: {', '\n  },')
const ismName = ism && field(ism, 'programName')
const ismDescription = ism && field(ism, 'description')
if (!ismName || !ismDescription) {
  throw new Error('prerender-meta: could not read portfolio.ism from src/data/portfolio.ts')
}
routes.push({
  path: '/ism',
  title: `${ismName} - ${author}`,
  description: clampText(ismDescription, 160),
})

// ISM sections - /ism/<section>, parsed from the ISM_SECTION_META literal
const ismMetaBlock = objectBlock(ismPageSource, 'const ISM_SECTION_META', '\n}\n')
if (!ismMetaBlock) {
  throw new Error('prerender-meta: could not find ISM_SECTION_META in src/pages/IsmPage.tsx')
}
const sectionMatches = [
  ...ismMetaBlock.matchAll(
    new RegExp(
      `(\\w+):\\s*\\{\\s*title:\\s*(${STRING}),\\s*description:\\s*(${STRING}),?\\s*\\}`,
      'g',
    ),
  ),
]
if (sectionMatches.length === 0) {
  throw new Error('prerender-meta: no ISM sections parsed from ISM_SECTION_META')
}
for (const match of sectionMatches) {
  routes.push({
    path: `/ism/${match[1]}`,
    title: `${decodeLiteral(match[2])} - ${author}`,
    description: clampText(decodeLiteral(match[3]), 160),
  })
}

/* ------------------------------------------------------------------ writing */

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`prerender-meta: ${join(DIST, 'index.html')} not found - run the build first.`)
  process.exit(1)
}

const template = readFileSync(join(DIST, 'index.html'), 'utf8')

function injectIntoHead(html, tag) {
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `    ${tag}\n  </head>`)
  return html.replace(/<head[^>]*>/i, (open) => `${open}\n    ${tag}`)
}

function setAttrTag(html, tagName, keyAttr, keyValue, valueAttr, value) {
  const re = new RegExp(
    `<${tagName}\\b[^>]*\\b${keyAttr}=(["'])${escapeRegExp(keyValue)}\\1[^>]*>`,
    'i',
  )
  const found = html.match(re)
  const escaped = escapeAttr(value)
  if (found) {
    const valueRe = new RegExp(`\\b${valueAttr}=(["'])[\\s\\S]*?\\1`, 'i')
    if (valueRe.test(found[0])) {
      const updated = found[0].replace(valueRe, `${valueAttr}="${escaped}"`)
      return html.replace(re, () => updated)
    }
  }
  return injectIntoHead(html, `<${tagName} ${keyAttr}="${keyValue}" ${valueAttr}="${escaped}" />`)
}

function renderRoute({ path, title, description }) {
  const url = `${ORIGIN}${path}`
  let html = template

  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    html = html.replace(
      /<title>[\s\S]*?<\/title>/i,
      () => `<title>${escapeAttr(title)}</title>`,
    )
  } else {
    html = injectIntoHead(html, `<title>${escapeAttr(title)}</title>`)
  }

  html = setAttrTag(html, 'meta', 'name', 'description', 'content', description)
  html = setAttrTag(html, 'meta', 'property', 'og:title', 'content', title)
  html = setAttrTag(html, 'meta', 'property', 'og:description', 'content', description)
  html = setAttrTag(html, 'meta', 'property', 'og:url', 'content', url)
  html = setAttrTag(html, 'meta', 'name', 'twitter:title', 'content', title)
  html = setAttrTag(html, 'meta', 'name', 'twitter:description', 'content', description)
  html = setAttrTag(html, 'link', 'rel', 'canonical', 'href', url)

  return html
}

for (const route of routes) {
  const dir = join(DIST, route.path)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), renderRoute(route), 'utf8')
}

const lastmod = new Date().toISOString().slice(0, 10)
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...['/', ...routes.map((r) => r.path)].map(
    (path) =>
      `  <url><loc>${escapeXml(`${ORIGIN}${path}`)}</loc><lastmod>${lastmod}</lastmod></url>`,
  ),
  '</urlset>',
  '',
].join('\n')

writeFileSync(join(DIST, 'sitemap.xml'), sitemap, 'utf8')

console.log(
  `prerender-meta: wrote ${routes.length} route HTML files + sitemap.xml (${routes.length + 1} urls) to ${DIST}`,
)
