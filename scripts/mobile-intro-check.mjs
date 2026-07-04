import { chromium, devices } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OUT = path.join(process.cwd(), 'scripts', 'mobile-screenshots')
const URL = process.env.TEST_URL ?? 'http://localhost:5173/'

async function metrics(page) {
  return page.evaluate(() => {
    const screen = document.querySelector('[data-testid="mobile-screen-frame"] .aspect-\\[16\\/10\\]')
    const cover = document.querySelector('[data-testid="mobile-lid-cover"]')
    const track = document.querySelector('#intro [data-scroll-progress]')
    const intro = document.getElementById('intro')
    const r = (el) => {
      if (!el) return null
      const b = el.getBoundingClientRect()
      return { w: Math.round(b.width), h: Math.round(b.height), ratio: +(b.width / b.height).toFixed(2) }
    }
    const coverVisible = cover
      ? Math.round(cover.getBoundingClientRect().height)
      : null
    const coverScale = cover ? getComputedStyle(cover).transform : null
    return {
      scrollY: window.scrollY,
      progress: track?.dataset.scrollProgress ?? null,
      screen: r(screen),
      coverHeight: coverVisible,
      coverScale,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      hasMobileLid: !!document.querySelector('[data-testid="mobile-lid"]'),
    }
  })
}

const iphone = devices['iPhone 14 Pro']

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
const context = await browser.newContext({
  ...iphone,
  hasTouch: true,
  isMobile: true,
})
const page = await context.newPage()
await mkdir(OUT, { recursive: true })

await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(800)

const report = []

for (const pct of [0, 0.15, 0.35, 0.55, 0.75]) {
  const introHeight = await page.evaluate(() => document.getElementById('intro')?.offsetHeight ?? 0)
  const maxScroll = Math.max(0, introHeight - 844)
  const y = Math.round(maxScroll * pct)
  await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y)
  await page.waitForTimeout(600)
  const m = await metrics(page)
  report.push({ pct, y, ...m })
  await page.screenshot({ path: path.join(OUT, `intro-${String(Math.round(pct * 100)).padStart(2, '0')}.png`), fullPage: false })
}

await writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))

const start = report[0]
const mid = report.find((r) => r.pct === 0.35) ?? report[2]
const issues = []
if (!start.hasMobileLid) issues.push('Mobile lid component not rendered (touch path not active)')
if (start.screen && start.screen.ratio < 1.45) issues.push(`Screen vertically compressed at start (ratio ${start.screen.ratio})`)
if (start.screen && start.screen.h < 100) issues.push(`Screen too short at start (${start.screen.h}px)`)
if (mid && mid.coverScale && parseFloat(mid.coverScale.split(',')[3] || '1') > 0.85) issues.push(`Cover should be mostly open mid-scroll (transform: ${mid.coverScale})`)

console.log('\nISSUES:', issues.length ? issues : ['none'])
process.exitCode = issues.length ? 1 : 0

await browser.close()
