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

/**
 * Build a stock map keyed by componentId.
 * @returns {Object<string, {id,name,unit,lowAt,received,used,stock,negative,low}>}
 */
export function computeStock(components, receipts, production) {
  const map = {}
  for (const c of components) {
    map[c.id] = { id: c.id, name: c.name, unit: c.unit || 'pcs', lowAt: num(c.lowAt), received: 0, used: 0, stock: 0, negative: false, low: false }
  }
  // helper to lazily include a component referenced by a movement but missing
  // from the master list (e.g. deleted) so its stock still shows.
  const ensure = (id, name) => {
    if (!map[id]) map[id] = { id, name: name || 'Unknown', unit: 'pcs', lowAt: 0, received: 0, used: 0, stock: 0, negative: false, low: false }
    return map[id]
  }

  for (const r of receipts) {
    if (!r.componentId) continue
    ensure(r.componentId, r.componentName).received += num(r.qty)
  }
  for (const p of production) {
    for (const c of (p.consumed || [])) {
      if (!c.componentId) continue
      ensure(c.componentId, c.componentName).used += num(c.qty)
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
