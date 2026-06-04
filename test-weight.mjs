/**
 * Weight-mode test (iPhone 13, local). Verifies a by-weight material:
 * weight→pieces conversion on incoming, the pieces→weight recheck, and the
 * weight equivalent on the dashboard. Needs the preview server on :4173.
 */
import { chromium, devices } from 'playwright'

const BASE = 'http://localhost:4173/fitting/?local=1'
const PWD = '6133923_N'
function assert(c, m) { if (!c) { console.error('  ✗ FAIL:', m); process.exitCode = 1; throw new Error(m) } console.log('  ✓', m) }

const browser = await chromium.launch()
const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage()
page.on('pageerror', e => { console.error('  ✗ PAGE ERROR:', e.message); process.exitCode = 1 })

const enterAdmin = async () => {
  await page.locator('text=Owner / Admin').click()
  await page.fill('input[type=password]', PWD); await page.click('text=Unlock')
  await page.waitForSelector('text=Admin Console')
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })

  console.log('\n[1] Add by-weight material: Steel Strip, 0.5 kg/pc')
  await enterAdmin()
  await page.locator('text=Components & Recipes').first().click()
  await page.fill('input[placeholder^="Component name"]', 'Steel Strip')
  await page.selectOption('select >> nth=0', { label: 'Weight' }) // Measured by
  await page.fill('input[placeholder="e.g. 0.25"]', '0.5')         // avg weight/piece
  await page.click('button:has-text("Add Component")')
  await page.waitForSelector('text=Steel Strip')
  assert(await page.locator('text=/pc').first().isVisible(), 'Weight badge shown on component')

  console.log('\n[2] Incoming by weight: 50 kg → 100 pcs')
  await page.click('text=Home')
  await page.locator('button:has-text("Receive stock, backup")').click()
  await page.waitForSelector('text=Incoming Material')
  // Select Steel Strip in the Incoming dropdown (many materials are seeded).
  const sel = page.locator('select').first()
  const val = await sel.locator('option', { hasText: 'Steel Strip' }).first().getAttribute('value')
  await sel.selectOption(val)
  await page.fill('input[placeholder="0"]', '50')
  await page.waitForSelector('text=100 pcs')
  assert(true, 'weight→pieces preview: 50 kg = 100 pcs')

  console.log('\n[3] Switch to pieces mode → recheck weight')
  await page.click('button:has-text("By pieces")')
  await page.fill('input[placeholder="0"]', '30')
  await page.waitForSelector('text=15')   // 30 × 0.5 = 15 kg
  assert(await page.locator('text=Recheck').first().isVisible(), 'pieces→weight recheck shown (30 pcs ≈ 15 kg)')

  console.log('\n[3b] Lot avg deviation >1% raises a red flag')
  await page.click('button:has-text("By weight")')
  await page.fill('input[placeholder="0.5"]', '0.6')   // 20% above standard 0.5
  await page.waitForSelector('text=off standard')
  assert(await page.locator('text=/🚩|off standard/').first().isVisible(), 'Red flag shown when lot avg is 20% off')
  await page.fill('input[placeholder="0.5"]', '0.5')   // back to standard

  console.log('\n[4] Save 50 kg back (weight mode) and check dashboard')
  await page.click('button:has-text("By weight")')
  await page.fill('input[placeholder="0"]', '50')
  await page.click('button:has-text("Add to Stock")')
  await page.waitForSelector('text=Made,text=Bought', { timeout: 3000 }).catch(() => {})
  await page.click('text=Home')
  await page.locator('text=Dashboard').first().click()
  await page.waitForSelector('text=Component Stock')
  assert(await page.locator('text=100 pcs').first().isVisible(), 'Dashboard: Steel Strip = 100 pcs')
  assert(await page.locator('text=/≈ 50 kg/').first().isVisible(), 'Dashboard shows ≈ 50 kg equivalent')

  console.log('\n✅ WEIGHT-MODE CHECKS PASSED')
} catch (e) {
  console.error('\n❌ TEST FAILED:', e.message)
  await page.screenshot({ path: 'test-weight-fail.png', fullPage: true }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
}
