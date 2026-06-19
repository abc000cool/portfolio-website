/** rel for external http(s) links; omit for mailto and same-origin. */
export function externalLinkRel(url: string): string | undefined {
  return url.startsWith('http') ? 'noopener noreferrer' : undefined
}
