import { useEffect } from 'react'

/** Production origin. index.html is not env-interpolated, so this is hardcoded there too. */
export const SITE_ORIGIN = 'https://www.anshpathak.us'

export interface DocumentHeadOptions {
  /** Full document title, e.g. "STRATOS - Ansh Pathak". */
  title: string
  /** Meta description / og:description. Kept short by the caller (see clampText). */
  description: string
  /** Absolute path for canonical + og:url, e.g. "/projects/stratos". Defaults to the current path. */
  canonicalPath?: string
}

interface ManagedTag {
  el: Element
  attr: string
  previous: string | null
  created: boolean
}

/**
 * Collapse whitespace and cut to `max` characters on a word boundary.
 * Used for titles/descriptions built from long-form copy (paper abstracts, taglines).
 */
export function clampText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  const trimmed = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut
  // Hyphen last so it is a literal, not a range endpoint.
  return `${trimmed.replace(/[\s,;:.–-]+$/, '')}…`
}

function normalizePath(path: string): string {
  const withSlash = path.startsWith('/') ? path : `/${path}`
  if (withSlash === '/') return '/'
  return withSlash.replace(/\/+$/, '')
}

/**
 * Per-route document head: title, description, canonical, og:title/description/url
 * (plus the matching twitter:* tags). Missing tags are created, existing ones are
 * updated, and every change is reverted on unmount so route changes never leak
 * one page's metadata onto another.
 *
 * Call this UNCONDITIONALLY - above any early return - or the hook order breaks.
 */
export function useDocumentHead({ title, description, canonicalPath }: DocumentHeadOptions): void {
  useEffect(() => {
    if (typeof document === 'undefined') return

    const managed: ManagedTag[] = []
    const previousTitle = document.title

    const apply = (selector: string, create: () => Element, attr: string, value: string) => {
      let el = document.head.querySelector(selector)
      let created = false
      if (!el) {
        el = create()
        document.head.appendChild(el)
        created = true
      }
      managed.push({ el, attr, previous: created ? null : el.getAttribute(attr), created })
      el.setAttribute(attr, value)
    }

    const meta = (key: 'name' | 'property', value: string) => () => {
      const el = document.createElement('meta')
      el.setAttribute(key, value)
      return el
    }

    const link = (rel: string) => () => {
      const el = document.createElement('link')
      el.setAttribute('rel', rel)
      return el
    }

    const path = normalizePath(
      canonicalPath ?? (typeof window === 'undefined' ? '/' : window.location.pathname),
    )
    const url = `${SITE_ORIGIN}${path === '/' ? '/' : path}`

    document.title = title
    apply('meta[name="description"]', meta('name', 'description'), 'content', description)
    apply('link[rel="canonical"]', link('canonical'), 'href', url)
    apply('meta[property="og:title"]', meta('property', 'og:title'), 'content', title)
    apply(
      'meta[property="og:description"]',
      meta('property', 'og:description'),
      'content',
      description,
    )
    apply('meta[property="og:url"]', meta('property', 'og:url'), 'content', url)
    apply('meta[name="twitter:title"]', meta('name', 'twitter:title'), 'content', title)
    apply(
      'meta[name="twitter:description"]',
      meta('name', 'twitter:description'),
      'content',
      description,
    )

    return () => {
      document.title = previousTitle
      for (let i = managed.length - 1; i >= 0; i -= 1) {
        const tag = managed[i]
        if (tag.created) {
          tag.el.remove()
        } else if (tag.previous === null) {
          tag.el.removeAttribute(tag.attr)
        } else {
          tag.el.setAttribute(tag.attr, tag.previous)
        }
      }
    }
  }, [title, description, canonicalPath])
}
