/**
 * Module-resolution hook so build scripts can import the site's TypeScript
 * data modules directly (Node 23.6+ strips types natively, but its ESM
 * resolver does not try extensions the way bundlers do - `./projectPages`
 * must become `./projectPages.ts`).
 *
 * Usage: register('./ts-import.mjs', import.meta.url) before importing.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (error) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context)
    }
    throw error
  }
}
