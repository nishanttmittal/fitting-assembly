/**
 * Smoke test (iPhone 13 viewport, offline/local mode via ?local=1).
 * Verifies the core floor-worker flow + admin setup + stock deduction.
 * Run the preview server first:  npm run build && npm run preview -- --port 4173
 */
import { chromium, devices } from 'playwright'

const BASE = 'http://localhost:4173/fitting-assembly/?local=1'
const iPhone = devices['iPhone 13']

function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL:', msg); process.exitCode = 1; throw new Error(msg) }
  console.log('  ✓', msg)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...iPhone })
const page = await ctx.newPage()
page.on('pageerror', e => { console.error('  ✗ PAGE ERROR:', e.message); process.exitCode = 1 })

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  // Start from a clean slate on this device.
  await page.evaluate(() => { localStorage.clear() })
  await page.reload({ waitUntil: 'networkidle' })

  console.log('\n[1] Home screen')
  await page.waitForSelector('text=Fitting Assembly')
  assert(await page.locator('text=Enter Production').first().isVisible(), 'Enter Production card visible')
  assert(await page.locator('text=Components & Recipes').first().isVisible(), 'Setup card visible')

  console.log('\n[2] Admin: add a component (M8 Bolt, opening 100)')
  await page.locator('text=Components & Recipes').first().click()
  await page.fill('input[type=password]', '6133923_N')
  await page.click('text=Unlock')
  await page.fill('input[placeholder^="Component name"]', 'M8 Bolt')
  await page.fill('input[placeholder="0"] >> nth=0', '100') // opening stock
  await page.click('button:has-text("Add Component")')
  await page.waitForSelector('text=M8 Bolt')
  assert(true, 'Component M8 Bolt added with opening stock')

  console.log('\n[3] Admin: set Product 1 recipe = 4 × M8 Bolt')
  await page.click('button:has-text("Products & Recipes")')
  await page.locator('button:has-text("Edit")').first().click()
  await page.click('text=+ Add component to recipe')
  await page.selectOption('select >> nth=-1', { label: 'M8 Bolt' })
  await page.fill('input[type=number] >> nth=-1', '4')
  await page.click('button:has-text("Save Recipe")')
  await page.waitForSelector('text=M8 Bolt × 4')
  assert(true, 'Product 1 recipe saved (4 × M8 Bolt)')

  console.log('\n[4] Floor: enter production Product 1 × 10')
  await page.click('text=Home')
  await page.locator('text=Enter Production').first().click()
  // product defaults to Product 1 (first); set qty 10
  await page.fill('input[inputmode=numeric]', '10')
  // preview should show 40 used / 100 in stock
  await page.waitForSelector('text=40 used')
  assert(await page.locator('text=40 used').first().isVisible(), 'Usage preview shows 40 used')
  await page.click('button:has-text("Save Production")')
  await page.waitForSelector('text=Saved:')
  await page.waitForSelector('text=× 10')
  assert(true, 'Production saved & shown in today list')

  console.log('\n[5] Dashboard: 10 made today, M8 Bolt stock = 60')
  await page.click('text=Home')
  await page.locator('text=Dashboard').first().click()
  await page.waitForSelector('text=Component Stock')
  assert(await page.locator('text=60 pcs').first().isVisible(), 'M8 Bolt stock reduced to 60 (100 − 4×10)')
  assert(await page.locator('text=Can Build Now').first().isVisible(), 'Can-build section present')

  console.log('\n✅ ALL CHECKS PASSED')
} catch (e) {
  console.error('\n❌ TEST FAILED:', e.message)
  await page.screenshot({ path: 'test-fail.png', fullPage: true }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
}
