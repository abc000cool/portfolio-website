/**
 * Screenshot the newest research viewers at several scroll-progress points.
 * Usage: node scripts/new-viewers-shot.mjs [baseUrl]
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = process.argv[2] ?? 'http://127.0.0.1:4173'
const OUT = 'scripts/shots'
mkdirSync(OUT, { recursive: true })

const errors = []

async function shotsForBlock(page, blockId, label, fractions) {
  const zone = await page.evaluate((id) => {
    const block = document.getElementById(id)
    if (!block) return null
    const scrollZone = block.querySelector('.research-showcase__scroll-zone')
    if (!scrollZone) return null
    const rect = scrollZone.getBoundingClientRect()
    const top = rect.top + window.scrollY
    return { top, height: rect.height, viewport: window.innerHeight }
  }, blockId)
  if (!zone) {
    console.log(`MISSING zone for ${blockId}`)
    return
  }
  for (const f of fractions) {
    const y = zone.top + (zone.height - zone.viewport) * f
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y)
    await page.waitForTimeout(1400)
    const viewer = page.locator(`#${blockId} .research-viewer`)
    await viewer.screenshot({ path: `${OUT}/${label}-${Math.round(f * 100)}.png` })
    console.log(`shot ${label} @ ${Math.round(f * 100)}%`)
  }
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
})

await page.goto(BASE, { waitUntil: 'networkidle' })
// Skip the intro if present, then jump near the research section to mount viewers.
await page.waitForTimeout(2500)
await page.evaluate(() => {
  const el = document.getElementById('research')
  if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' })
})
await page.waitForTimeout(2500)

await shotsForBlock(page, 'research-nozzlemoc', 'nozzle', [0.05, 0.25, 0.5, 0.7, 0.92])
await shotsForBlock(page, 'research-eilj2', 'eilj2', [0.05, 0.35, 0.6, 0.72, 0.95])
await shotsForBlock(page, 'research-bli', 'bli', [0.05, 0.25, 0.45, 0.6, 0.92])
await shotsForBlock(page, 'research-rde', 'rde', [0.05, 0.25, 0.45, 0.7, 0.95])

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console errors')
await browser.close()
