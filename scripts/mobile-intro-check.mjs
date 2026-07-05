import { chromium, devices } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OUT = path.join(process.cwd(), 'scripts', 'mobile-screenshots')
const URL = process.env.TEST_URL ?? 'http://localhost:5173/'

async function metrics(page) {
  return page.evaluate(() => {
    const screen = document.querySelector('[data-testid="mobile-screen-frame"] .aspect-\\[16\\/10\\]')
    const closed = document.querySelector('[data-testid="mobile-closed-screen"]')
    const cover = document.querySelector('[data-testid="mobile-lid-cover"]')
    const laptopWrap = document.querySelector('[data-testid="mobile-lid"]')?.parentElement
    const wrapOpacity = laptopWrap ? getComputedStyle(laptopWrap).opacity : null
    const r = (el) => {
      if (!el) return null
      const b = el.getBoundingClientRect()
      return { w: Math.round(b.width), h: Math.round(b.height), ratio: +(b.width / b.height).toFixed(2) }
    }
    const opacity = (el) => (el ? getComputedStyle(el).opacity : null)
    return {
      scrollY: window.scrollY,
      screen: r(screen),
      closedOpacity: opacity(closed),
      hasCoverOverlay: !!cover,
      wrapOpacity,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      hasMobileLid: !!document.querySelector('[data-testid="mobile-lid"]'),
    }
  })
}

const iphone = devices['iPhone 14 Pro']
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
const context = await browser.newContext({ ...iphone, hasTouch: true, isMobile: true })
const page = await context.newPage()
await mkdir(OUT, { recursive: true })

await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(800)

const report = []
for (const pct of [0, 0.15, 0.35, 0.55, 0.75, 0.92]) {
  const introHeight = await page.evaluate(() => document.getElementById('intro')?.offsetHeight ?? 0)
  const maxScroll = Math.max(0, introHeight - 660)
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
const end = report.find((r) => r.pct === 0.92) ?? report[5]
const issues = []
if (!start.hasMobileLid) issues.push('Mobile MacBook not rendered')
if (start.hasCoverOverlay) issues.push('Black cover overlay still present')
if (start.screen && start.screen.ratio < 1.45) issues.push(`Screen compressed at start (ratio ${start.screen.ratio})`)
if (start.closedOpacity && Number(start.closedOpacity) < 0.8) issues.push(`Closed screen not visible at start (opacity ${start.closedOpacity})`)
if (mid && Number(mid.closedOpacity) > 0.55) issues.push(`Closed screen still dominant mid-scroll (opacity ${mid.closedOpacity})`)
if (end && Number(end.wrapOpacity ?? 1) > 0.08) issues.push(`MacBook should be faded near end of intro (opacity ${end.wrapOpacity} at 92%)`)
const midOpen = report.find((r) => r.pct === 0.55)
if (midOpen && Number(midOpen.wrapOpacity ?? 0) < 0.9) issues.push(`MacBook fading too early at 55% scroll (${midOpen.wrapOpacity})`)

console.log('\nISSUES:', issues.length ? issues : ['none'])
process.exitCode = issues.length ? 1 : 0
await browser.close()
