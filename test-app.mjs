/**
 * Smoke test (iPhone 13 viewport, offline/local mode via ?local=1).
 * Covers: role chooser → admin console setup → shop-floor production →
 * stock deduction → sourcing (purchased/manufactured) → name-based auto-feed.
 * Start the preview server first:  npm run preview -- --port 4173
 */
import { chromium, devices } from 'playwright'

const BASE = 'http://localhost:4173/fitting/?local=1'
const iPhone = devices['iPhone 13']
const PWD = '6133923_N'

function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL:', msg); process.exitCode = 1; throw new Error(msg) }
  console.log('  ✓', msg)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...iPhone })
const page = await ctx.newPage()
page.on('pageerror', e => { console.error('  ✗ PAGE ERROR:', e.message); process.exitCode = 1 })

const enterAdmin = async () => {
  await page.locator('text=Owner / Admin').click()
  await page.fill('input[type=password]', PWD)
  await page.click('text=Unlock')
  await page.waitForSelector('text=Admin Console')
}
const switchRole = async () => { await page.locator('button:has-text("Switch")').click() }

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })

  console.log('\n[1] Role chooser')
  await page.waitForSelector('text=Shop Floor')
  assert(await page.locator('text=Owner / Admin').isVisible(), 'Both interfaces offered on launch')

  console.log('\n[2] Admin console: add component M8 Bolt (opening 100, Purchased)')
  await enterAdmin()
  await page.locator('text=Components & Recipes').first().click()
  await page.fill('input[placeholder^="Component name"]', 'M8 Bolt')
  await page.fill('input[placeholder="0"] >> nth=0', '100') // opening stock
  await page.click('button:has-text("Add Component")')
  await page.waitForSelector('text=M8 Bolt')
  assert(await page.locator('text=Bought').first().isVisible(), 'Component tagged Bought (purchased)')

  console.log('\n[3] Set first product recipe = 4 × M8 Bolt (toppings picker)')
  await page.click('button:has-text("Products & Recipes")')
  await page.locator('button:has-text("Edit")').first().click()
  await page.waitForSelector('text=Add raw material')
  await page.locator('button:has-text("M8 Bolt")').click()   // ＋ add from available list
  await page.fill('input[type=number]', '4')                 // qty per piece (only number input)
  await page.click('button:has-text("Save Recipe")')
  await page.waitForSelector('text=M8 Bolt × 4')
  assert(true, 'Recipe saved via toppings picker (4 × M8 Bolt)')

  console.log('\n[4] Admin → Incoming Material: receive 20 Manufactured')
  await page.click('text=Home')
  await page.locator('button:has-text("Receive stock, backup")').click() // the Admin card
  await page.waitForSelector('text=Incoming Material')
  await page.click('button:has-text("Manufactured")')
  await page.fill('input[placeholder="0"]', '20')
  await page.click('button:has-text("Add to Stock")')
  await page.waitForSelector('text=Made')
  assert(true, 'Received 20 manufactured (stock now 120)')

  console.log('\n[5] Shop Floor: enter Product 1 × 10 (uses 40)')
  await switchRole()
  await page.locator('text=Shop Floor').click()
  await page.waitForSelector('text=Enter Production')
  await page.fill('input[inputmode=numeric]', '10')
  await page.waitForSelector('text=40 used')
  await page.click('button:has-text("Save Production")')
  await page.waitForSelector('text=Saved:')
  assert(await page.locator('text=× 10').first().isVisible(), 'Production saved on floor interface')

  console.log('\n[6] Name-based auto-feed: inject receipt by name only')
  await page.evaluate(() => {
    const key = 'fa:receipts'
    const list = JSON.parse(localStorage.getItem(key) || '[]')
    list.push({ id: 'feed_test_1', date: new Date().toISOString().slice(0,10),
      componentId: '', componentName: 'm8 bolt', qty: 50,
      source: 'manufactured', sourceApp: 'coil-slitter', ref: 'CS-1', createdAt: new Date().toISOString() })
    localStorage.setItem(key, JSON.stringify(list))
  })
  await page.reload({ waitUntil: 'networkidle' })

  console.log('\n[7] Admin → Dashboard: verify totals')
  // After reload the device is still in Shop Floor mode (role persists) — switch.
  await switchRole()
  await enterAdmin()
  await page.locator('text=Dashboard').first().click()
  await page.waitForSelector('text=Component Stock')
  // 100 purchased + 20 made + 50 fed − 40 used = 130
  assert(await page.locator('text=130 pcs').first().isVisible(), 'Stock = 130 (name-fed 50 attached to M8 Bolt)')
  assert(await page.locator('text=Material In').first().isVisible(), 'Material In summary present')
  assert(await page.locator('text=Can Build Now').first().isVisible(), 'Can-build section present')

  console.log('\n✅ ALL CHECKS PASSED')
} catch (e) {
  console.error('\n❌ TEST FAILED:', e.message)
  await page.screenshot({ path: 'test-fail.png', fullPage: true }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
}
