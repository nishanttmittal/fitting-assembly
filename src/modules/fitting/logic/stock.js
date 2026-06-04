/**
 * Stock & assembly logic — pure functions, no storage/UI.
 *
 * Component stock is DERIVED, never stored:
 *     stock(component) = Σ receipts(component) − Σ production.consumed(component)
 * This is concurrency-safe (no read-modify-write races across devices) and lets
 * any historical figure be recomputed exactly.
 */

/** Number coercion that treats blanks/NaN as 0. */
const num = (v) => Number(v) || 0

/** Normalize a name for matching: lowercase, collapse whitespace. */
const normName = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ')

// ── weight ↔ pieces conversions (for materials measured by weight) ──────────

/** Pieces implied by a weight, rounded to whole pieces (0 if no avg weight). */
export function piecesFromWeight(avgWeight, weight) {
  const a = num(avgWeight)
  return a > 0 ? Math.round(num(weight) / a) : 0
}

/** Expected total weight for a piece count (for the "recheck weight" feature). */
export function weightFromPieces(avgWeight, pieces) {
  return num(avgWeight) * num(pieces)
}

/**
 * Percentage a lot's average weight deviates from the admin standard.
 * @returns {number} absolute deviation %, or 0 when no standard to compare to.
 */
export function avgDeviationPct(standardAvg, lotAvg) {
  const s = num(standardAvg), l = num(lotAvg)
  if (s <= 0 || l <= 0) return 0
  return Math.abs(l - s) / s * 100
}

/**
 * Build a stock map keyed by componentId.
 *
 * Movements (receipts / production.consumed) are resolved to a master component
 * by id first, then by NAME — so material auto-fed from another app, which only
 * knows the component's name (not this app's internal id), still attaches to the
 * right component. Anything that matches nothing is shown under its own name so
 * the admin notices and can add it.
 *
 * @returns {Object<string, {id,name,unit,lowAt,source,received,used,stock,negative,low}>}
 */
export function computeStock(components, receipts, production) {
  const map = {}
  const byId = {}
  const byName = {}
  for (const c of components) {
    const entry = {
      id: c.id, name: c.name, unit: c.unit || 'pcs', lowAt: num(c.lowAt),
      source: c.source || 'purchased',
      measureBy: c.measureBy || 'number', avgWeight: num(c.avgWeight), weightUnit: c.weightUnit || 'kg',
      received: 0, used: 0, stock: 0, negative: false, low: false,
    }
    map[c.id] = entry
    byId[c.id] = entry
    if (c.name) byName[normName(c.name)] = entry
  }

  // Resolve a movement to a stock entry (by id, then name), creating a
  // placeholder entry if it matches no known component.
  const resolve = (id, name) => {
    if (id && byId[id]) return byId[id]
    const nn = normName(name)
    if (nn && byName[nn]) return byName[nn]
    const key = id || (nn ? `name:${nn}` : 'unknown')
    if (!map[key]) {
      map[key] = { id: key, name: name || 'Unknown', unit: 'pcs', lowAt: 0, source: 'purchased', measureBy: 'number', avgWeight: 0, weightUnit: 'kg', received: 0, used: 0, stock: 0, negative: false, low: false }
      if (nn) byName[nn] = map[key]
    }
    return map[key]
  }

  for (const r of receipts) {
    resolve(r.componentId, r.componentName).received += num(r.qty)
  }
  for (const p of production) {
    for (const c of (p.consumed || [])) {
      resolve(c.componentId, c.componentName).used += num(c.qty)
    }
  }
  for (const id in map) {
    const m = map[id]
    m.stock = m.received - m.used
    m.negative = m.stock < 0
    m.low = m.stock >= 0 && m.lowAt > 0 && m.stock <= m.lowAt
  }
  return map
}

/**
 * Totals of material received, split by source, within an optional date range.
 * @returns {{purchased:number, manufactured:number, total:number}}
 */
export function incomingSummary(receipts, from, to) {
  let purchased = 0, manufactured = 0
  for (const r of receipts) {
    if (from && r.date < from) continue
    if (to && r.date > to) continue
    const q = num(r.qty)
    if (r.source === 'manufactured') manufactured += q
    else purchased += q
  }
  return { purchased, manufactured, total: purchased + manufactured }
}

/** The recipe rows of a product (array of {componentId, qty}). */
export const recipeOf = (product) => (product && Array.isArray(product.recipe) ? product.recipe : [])

/**
 * Snapshot of components consumed when assembling `qty` of `product`.
 * Names are resolved from the components list so the snapshot is self-contained.
 * @returns {Array<{componentId,componentName,qty}>}
 */
export function consumedFor(product, qty, components) {
  const byId = Object.fromEntries(components.map(c => [c.id, c]))
  return recipeOf(product)
    .filter(r => r.componentId && num(r.qty) > 0)
    .map(r => ({
      componentId: r.componentId,
      componentName: byId[r.componentId]?.name || 'Unknown',
      qty: num(r.qty) * num(qty),
    }))
}

/**
 * How many whole pieces of `product` can be built from current stock.
 * @returns {number|null} null when the product has no recipe (unknown).
 */
export function canBuild(product, stockMap) {
  const recipe = recipeOf(product).filter(r => r.componentId && num(r.qty) > 0)
  if (recipe.length === 0) return null
  let min = Infinity
  for (const r of recipe) {
    const have = stockMap[r.componentId]?.stock ?? 0
    min = Math.min(min, Math.floor(have / num(r.qty)))
  }
  return Math.max(0, min === Infinity ? 0 : min)
}

/**
 * Check whether `qty` of `product` can be assembled from current stock.
 * @returns {{ok:boolean, short:Array<{componentName,need,have,shortBy}>}}
 */
export function checkAvailability(product, qty, components, stockMap) {
  const need = consumedFor(product, qty, components)
  const short = []
  for (const n of need) {
    const have = stockMap[n.componentId]?.stock ?? 0
    if (n.qty > have) short.push({ componentName: n.componentName, need: n.qty, have, shortBy: n.qty - have })
  }
  return { ok: short.length === 0, short, need }
}

/** Components currently negative or at/below their low-stock alert level. */
export function shortages(stockMap) {
  return Object.values(stockMap)
    .filter(m => m.negative || m.low)
    .sort((a, b) => a.stock - b.stock)
}
