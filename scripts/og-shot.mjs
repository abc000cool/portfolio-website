/**
 * Generates public/og.jpg — the 1200x630 social share card referenced by
 * index.html and by every prerendered route head.
 *
 * Shoots the real landing screen from a built copy of the site, so the card can
 * never drift from what a visitor actually lands on.
 *
 * Usage:
 *   npm run build && npm run preview      # in one terminal
 *   node scripts/og-shot.mjs              # in another (defaults to :4173)
 *   node scripts/og-shot.mjs http://localhost:5173
 *
 * Uses the Playwright already in devDependencies. If Playwright's own browser
 * download is unavailable, set CHROME_PATH to a local Chrome/Edge binary.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.argv[2] || 'http://localhost:4173'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'og.jpg')

// Must match og:image:width / og:image:height in index.html. A deviceScaleFactor
// of 2 would export 2400x1260 and contradict the declared dimensions.
const WIDTH = 1200
const HEIGHT = 630

const launchOptions = { args: ['--hide-scrollbars'] }
if (process.env.CHROME_PATH) launchOptions.executablePath = process.env.CHROME_PATH

const browser = await chromium.launch(launchOptions)
const ctx = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
  // Capture a settled frame rather than a half-played entrance animation.
  reducedMotion: 'reduce',
})
const page = await ctx.newPage()

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('h1', { timeout: 15000 })
await page.waitForTimeout(2500)

await page.screenshot({ path: OUT, type: 'jpeg', quality: 88 })
await browser.close()

const kb = Math.round(fs.statSync(OUT).size / 1024)
console.log(`og-shot: wrote public/og.jpg — ${WIDTH}x${HEIGHT}, ${kb} kB`)
if (kb > 300) {
  console.warn('og-shot: WARNING over 300 kB — lower the JPEG quality or simplify the frame')
}
