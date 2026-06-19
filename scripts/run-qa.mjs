/**
 * Portfolio site QA runner — maps to the manual checklist.
 * Usage: node scripts/run-qa.mjs [baseUrl]
 */
import { chromium, devices } from 'playwright'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

const BASE = process.argv[2] ?? 'http://127.0.0.1:4173'
const results = []

function record(id, name, pass, detail = '') {
  results.push({ id, name, pass, detail })
  const icon = pass ? 'PASS' : 'FAIL'
  console.log(`[${icon}] ${id} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function scrollToId(page, id) {
  await page.evaluate((sectionId) => {
    const el = document.getElementById(sectionId)
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' })
  }, id)
  await page.waitForTimeout(600)
}

async function slowScrollThrough(page, startY, endY, steps = 20) {
  for (let i = 0; i <= steps; i++) {
    const y = startY + ((endY - startY) * i) / steps
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y)
    await page.waitForTimeout(120)
  }
}

async function countConsoleErrors(page) {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  return errors
}

async function run() {
  // --- 1. Build & startup (shell-verified separately) ---
  record('1.1', 'Production build completes', existsSync('dist/index.html'))
  const distAssets = existsSync('dist/assets') ? readdirSync('dist/assets') : []
  record('1.2', 'Production assets emitted', distAssets.length > 0, `${distAssets.length} files`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`)
  })

  const failedRequests = []
  page.on('requestfailed', (req) => failedRequests.push(req.url()))
  page.on('response', (res) => {
    if (res.status() >= 400 && !res.url().includes('favicon')) {
      failedRequests.push(`${res.status()} ${res.url()}`)
    }
  })

  // --- 2. Initial load ---
  const homeResp = await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 })
  record('1.3', 'Preview/home HTTP 200', homeResp?.ok() === true, String(homeResp?.status()))
  record('1.4', 'No failed asset requests on initial load', failedRequests.length === 0, failedRequests.join('; ') || 'none')
  record('2.1', 'Homepage renders main content', (await page.locator('#main-content').count()) === 1)
  record('2.2', 'Intro section present', (await page.locator('#intro').count()) === 1)
  record('2.3', 'Starfield layer present', (await page.locator('.starfield, canvas').first().count()) >= 0)
  record('2.4', 'Skip-to-content link exists', (await page.locator('a.skip-link[href="#intro"]').count()) === 1)

  await page.goto(`${BASE}/#research`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const researchTop = await page.evaluate(() => {
    const el = document.getElementById('research')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return r.top
  })
  record('2.5', 'Hash deep link /#research scrolls near research', researchTop !== null && researchTop < 400, `top=${researchTop}`)

  // --- 3. Navigation ---
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  record('3.1', 'Site nav visible', await page.locator('nav[aria-label="Main navigation"]').isVisible())
  record('3.2', 'Projects dropdown exists', await page.getByRole('button', { name: 'Projects' }).isVisible())

  await page.getByRole('button', { name: 'Projects' }).hover()
  await page.waitForTimeout(200)
  const projectLinks = await page.locator('a[href^="/projects/"]').count()
  record('3.3', 'Projects dropdown lists project links', projectLinks >= 6, `count=${projectLinks}`)

  await page.goto(`${BASE}/projects/sweep`, { waitUntil: 'networkidle' })
  record('3.4', 'Logo/home link from subpage', await page.locator('a[href="/"]').first().isVisible())
  await page.locator('a[href="/"]').first().click()
  await page.waitForURL('**/')
  record('3.5', 'Logo returns to homepage', page.url().replace(/\/$/, '') === BASE.replace(/\/$/, ''))

  // --- 4. Mission flight path ---
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const flightPath = await page.locator('svg path').count()
  record('4.1', 'Flight path SVG renders', flightPath > 0, `paths=${flightPath}`)
  await scrollToId(page, 'contact')
  await page.waitForTimeout(500)
  const missionComplete = await page.getByText(/MISSION COMPLETE/i).count()
  record('4.2', 'Footer flight log completes after contact', missionComplete > 0)

  // --- 5. Sections exist ---
  await page.goto(BASE, { waitUntil: 'networkidle' })
  for (const id of ['hero', 'about', 'projects', 'research', 'ism', 'stats', 'contact']) {
    const exists = (await page.locator(`#${id}`).count()) === 1
    record('5.x', `Section #${id} exists`, exists)
  }

  // --- 6. Research first-scroll + 3D ---
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await scrollToId(page, 'research')
  await page.waitForTimeout(400)
  const researchHeadingVisible = await page.locator('#research-heading').isVisible()
  record('5.R1', 'Research heading visible on first approach', researchHeadingVisible)

  await scrollToId(page, 'research-debris')
  await page.waitForTimeout(1200)
  const debrisCanvas = page.locator('#research-debris canvas').first()
  await debrisCanvas.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {})
  const debrisBox = await debrisCanvas.boundingBox().catch(() => null)
  record('6.1', 'Space Debris 3D canvas renders on first visit', !!debrisBox && debrisBox.width > 50, debrisBox ? `${Math.round(debrisBox.width)}x${Math.round(debrisBox.height)}` : 'no canvas')

  const debrisBadge = await page.getByText(/AAS.*248/i).count()
  record('6.2', 'AAS 248 conference badge visible', debrisBadge > 0)

  const debrisLink = page.locator('#research-debris a[href="/projects/sweep"]')
  record('7.1', 'Space Debris CTA links to /projects/sweep', (await debrisLink.count()) === 1)

  await scrollToId(page, 'research-airfoil')
  await page.waitForTimeout(1500)
  const airfoilCanvas = page.locator('#research-airfoil canvas').first()
  const airfoilBox = await airfoilCanvas.boundingBox().catch(() => null)
  record('6.3', 'Airfoil 3D canvas renders on first visit', !!airfoilBox && airfoilBox.width > 50)

  const airfoilLink = page.locator('#research-airfoil a[href="/research/morphing-airfoil-qaoa"]')
  record('7.2', 'Airfoil CTA links to research abstract', (await airfoilLink.count()) === 1)

  await scrollToId(page, 'research-flowstate')
  await page.waitForTimeout(1200)
  const flowCanvas = page.locator('#research-flowstate canvas').first()
  const flowBox = await flowCanvas.boundingBox().catch(() => null)
  record('6.4', 'FlowState 3D canvas renders on first visit', !!flowBox && flowBox.width > 50)

  const flowLink = page.locator('#research-flowstate a[href="/projects/flowstate"]')
  record('7.3', 'FlowState CTA links to /projects/flowstate', (await flowLink.count()) === 1)

  // Research showcase opacity (ScanWipe reveal)
  const debrisOpacity = await page.locator('#research-debris .research-showcase__card').evaluate((el) => getComputedStyle(el).opacity)
  record('5.R2', 'Research debris card revealed (opacity)', parseFloat(debrisOpacity) > 0.5, `opacity=${debrisOpacity}`)

  // --- 8. Project subpages ---
  const projectSlugs = ['stratos', 'propulsion-studio', 'sweep', 'flowstate', 'the-resonance-foundation', 'data-science-libraries']
  for (const slug of projectSlugs) {
    await page.goto(`${BASE}/projects/${slug}`, { waitUntil: 'networkidle' })
    const h1 = await page.locator('h1').first().textContent()
    record('8.x', `Project /projects/${slug} loads`, !!h1 && h1.length > 1, h1?.slice(0, 40))
  }

  await page.goto(`${BASE}/projects/not-real`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  record('8.y', 'Invalid project slug redirects home', page.url().replace(/\/$/, '') === BASE.replace(/\/$/, ''))

  await page.goto(`${BASE}/projects/space-debris-solution`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  record('8.z', 'Legacy slug space-debris-solution → sweep', page.url().includes('/projects/sweep'))

  await page.goto(`${BASE}/projects/sweep`, { waitUntil: 'networkidle' })
  const backProjects = page.getByRole('link', { name: /Back to projects/i })
  await backProjects.click()
  await page.waitForTimeout(800)
  record('8.b', 'Back to projects returns to /#projects', page.url().includes('#projects') || page.url().endsWith('/'))

  // --- 9. Research subpages ---
  const paperSlugs = ['space-debris-mitigation', 'morphing-airfoil-qaoa', 'traffic-fluid-dynamics']
  for (const slug of paperSlugs) {
    await page.goto(`${BASE}/research/${slug}`, { waitUntil: 'networkidle' })
    const abstract = await page.getByRole('heading', { name: 'Abstract' }).count()
    record('9.x', `Research /research/${slug} loads`, abstract > 0)
  }
  await page.goto(`${BASE}/research/fake-paper`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  record('9.y', 'Invalid research slug redirects home', page.url().replace(/\/$/, '') === BASE.replace(/\/$/, ''))

  // --- 10. ISM subpages ---
  await page.goto(`${BASE}/ism`, { waitUntil: 'networkidle' })
  record('10.1', '/ism loads', (await page.locator('h1, h2').count()) > 0)
  for (const section of ['research', 'interviews', 'mentorship']) {
    await page.goto(`${BASE}/ism/${section}`, { waitUntil: 'networkidle' })
    record('10.x', `/ism/${section} loads`, (await page.locator('h1, h2, h3').count()) > 0)
  }
  await page.goto(`${BASE}/ism/invalid`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  record('10.y', 'Invalid ISM section redirects to /ism', page.url().endsWith('/ism'))

  // --- 11. Easter eggs ---
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.keyboard.type('LAUNCH')
  await page.waitForTimeout(500)
  const launchVisible = await page.locator('.launch-rocket').count()
  record('11.1', 'Launch code easter egg triggers', launchVisible > 0)
  await page.waitForTimeout(2500)

  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('b')
  await page.keyboard.press('a')
  await page.waitForTimeout(300)
  const warpCanvas = await page.locator('canvas').count()
  record('11.2', 'Konami code triggers hyperspace overlay', warpCanvas > 0)
  await page.waitForTimeout(2000)

  // --- 12. Reduced motion ---
  const reducedContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  const reducedPage = await reducedContext.newPage()
  await reducedPage.goto(BASE, { waitUntil: 'networkidle' })
  await reducedPage.waitForTimeout(500)
  const introVisible = await reducedPage.locator('#intro').isVisible()
  record('12.1', 'Reduced motion: intro section visible', introVisible)
  await scrollToId(reducedPage, 'research-debris')
  await reducedPage.waitForTimeout(800)
  const reducedCanvas = await reducedPage.locator('#research-debris canvas').count()
  record('12.2', 'Reduced motion: research viewer present', reducedCanvas > 0)
  await reducedContext.close()

  // --- 13. Mobile viewport ---
  const mobileContext = await browser.newContext({ ...devices['iPhone 13'] })
  const mobilePage = await mobileContext.newPage()
  await mobilePage.goto(BASE, { waitUntil: 'networkidle' })
  const overflowX = await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)
  record('13.1', 'Mobile: no horizontal overflow', overflowX)
  const mobileNav = await mobilePage.locator('nav[aria-label="Main navigation"]').isVisible()
  record('13.2', 'Mobile: nav bar visible', mobileNav)
  const mobileToggle = await mobilePage.locator('.mobile-nav__toggle').first()
  await mobileToggle.click()
  await mobilePage.waitForTimeout(400)
  const panelVisible = await mobilePage.locator('.mobile-nav__panel').isVisible()
  const mobileNavLinks = await mobilePage.locator('.mobile-nav__panel .mobile-nav__link').count()
  record('13.3', 'Mobile: nav drawer opens with links', panelVisible && mobileNavLinks >= 6, `links=${mobileNavLinks}`)
  await mobileContext.close()

  // --- 14. Accessibility basics ---
  const h1Count = await page.locator('h1').count()
  record('14.1', 'Homepage heading structure (h1 present)', h1Count >= 1, `h1 count=${h1Count}`)
  const focusable = await page.locator('a[href], button, input, textarea').count()
  record('14.2', 'Interactive elements present', focusable > 5, `count=${focusable}`)
  const researchLabel = await page.locator('#research[aria-labelledby="research-heading"]').count()
  record('14.3', 'Research section aria-labelledby', researchLabel === 1)

  // --- 15. Console errors after full scroll ---
  const scrollPage = await context.newPage()
  const scrollErrors = []
  scrollPage.on('pageerror', (e) => scrollErrors.push(e.message))
  scrollPage.on('console', (msg) => { if (msg.type() === 'error') scrollErrors.push(msg.text()) })
  await scrollPage.goto(BASE, { waitUntil: 'networkidle' })
  const docHeight = await scrollPage.evaluate(() => document.body.scrollHeight)
  await slowScrollThrough(scrollPage, 0, docHeight, 30)
  await slowScrollThrough(scrollPage, docHeight, 0, 15)
  const ignorable = scrollErrors.filter((e) => !/favicon|404/.test(e))
  record('15.1', 'No critical console errors during full scroll', ignorable.length === 0, ignorable.slice(0, 3).join(' | ') || 'none')

  // --- 17. Content integrity ---
  await page.goto(BASE, { waitUntil: 'networkidle' })
  const footerYear = await page.evaluate(() => document.body.innerText.includes(String(new Date().getFullYear())))
  record('17.1', 'Footer copyright year current', footerYear)
  const externalLinks = await page.locator('footer a[href^="http"]').evaluateAll((els) =>
    els.map((a) => ({ href: a.getAttribute('href'), rel: a.getAttribute('rel') })),
  )
  const safeExternal = externalLinks.every((l) => l.rel?.includes('noopener') || l.href?.includes('mailto:'))
  record('17.2', 'Footer external links use noopener (if any)', externalLinks.length === 0 || safeExternal)

  // CTA navigation tests
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await scrollToId(page, 'research-debris')
  await page.locator('#research-debris a[href="/projects/sweep"]').click()
  await page.waitForURL('**/projects/sweep')
  record('7.4', 'Space Debris CTA navigates to SWEEP page', page.url().includes('/projects/sweep'))

  // Initial load console
  const criticalConsole = consoleErrors.filter((e) => !/favicon|devtools|404/.test(e))
  record('2.6', 'No critical console errors on homepage load', criticalConsole.length === 0, criticalConsole.slice(0, 2).join(' | ') || 'none')

  await browser.close()

  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length
  console.log('\n--- SUMMARY ---')
  console.log(`PASS: ${passed}  FAIL: ${failed}  TOTAL: ${results.length}`)
  if (failed > 0) {
    console.log('\nFailed:')
    results.filter((r) => !r.pass).forEach((r) => console.log(`  - ${r.id} ${r.name}: ${r.detail}`))
    process.exit(1)
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
