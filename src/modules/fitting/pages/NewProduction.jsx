/**
 * Enter Production — the floor worker's main screen, kept dead-simple:
 *   1. Date (defaults to today)
 *   2. Tap the product's PHOTO tile
 *   3. Enter quantity → Save
 * Saving snapshots the components consumed and deducts stock. A shortage is
 * warned but never blocks saving.
 */
import { useMemo, useState } from 'react'
import { Button, Card, FieldLabel, NumberInput, NumberStepper, SearchBar, useToast, Toast } from '../../../core/ui'
import { todayStr, fmtNum, fmtDate } from '../../../core/utils/format'
import { useFitting } from '../FittingContext'
import { QUICK_QTYS } from '../config'
import { computeStock, consumedFor, checkAvailability, recipeOf } from '../logic/stock'
import ProductPhoto from '../components/ProductPhoto'

export default function NewProduction() {
  const { components, products, receipts, production, adjustments, rejects, log, lastUsed } = useFitting()
  const { msg, show } = useToast()

  const sortedProducts = useMemo(
    () => [...products.list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)),
    [products.list]
  )

  const [date, setDate] = useState(todayStr())
  const [productId, setProductId] = useState(null)
  const [qty, setQty] = useState('')
  const [reject, setReject] = useState('')
  const [search, setSearch] = useState('')

  const product = sortedProducts.find(p => p.id === productId)
  const stockMap = useMemo(
    () => computeStock(components.list, receipts.list, production.list, adjustments.list, rejects.list),
    [components.list, receipts.list, production.list, adjustments.list, rejects.list]
  )
  const n = Number(qty) || 0
  const rej = Number(reject) || 0
  const total = n + rej // both good and rejected pieces consumed materials
  const avail = product && total > 0 ? checkAvailability(product, total, components.list, stockMap) : null
  const hasRecipe = recipeOf(product).length > 0

  const todays = production.list
    .filter(p => p.date === date)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  const term = search.trim().toLowerCase()
  const tiles = sortedProducts.filter(p => !term || p.name.toLowerCase().includes(term))

  const pick = (id) => { setProductId(id); setQty(''); setReject('') }

  const save = () => {
    if (!product) return show('Pick a product first', 2000)
    if (total <= 0) return show('Enter a quantity', 2000)
    const consumed = consumedFor(product, total, components.list) // good + reject both use materials
    production.insert({ date, productId: product.id, productName: product.name, qty: n, reject: rej, consumed })
    log('PRODUCE', `${product.name} × ${n}${rej ? ` (+${rej} reject)` : ''} on ${fmtDate(date)}`)
    lastUsed.set({ ...lastUsed.get(), productId: product.id })
    show(`Saved: ${product.name} × ${fmtNum(n)} ✓`)
    setQty(''); setReject('')
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />

      {/* 1. Date */}
      <Card className="p-4">
        <FieldLabel>Date</FieldLabel>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="mt-1.5 w-full border-2 border-slate-300 rounded-2xl px-4 py-3 text-base font-semibold focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-500" />
      </Card>

      {/* 2. Pick product (photo tiles) OR 3. enter qty for the picked one */}
      {!product ? (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <FieldLabel>Tap the product</FieldLabel>
          </div>
          {sortedProducts.length > 6 && <SearchBar value={search} onChange={setSearch} placeholder="Search product…" />}
          <div className="grid grid-cols-2 gap-3">
            {tiles.map(p => (
              <button key={p.id} onClick={() => pick(p.id)}
                className="bg-white border-2 border-slate-200 rounded-2xl p-2 flex flex-col items-center gap-1.5 active:scale-95 transition-transform hover:border-blue-300">
                <ProductPhoto product={p} className="w-full h-24" />
                <span className="text-xs font-bold text-slate-700 text-center leading-tight line-clamp-2">{p.name}</span>
              </button>
            ))}
            {tiles.length === 0 && <p className="text-sm text-slate-400 col-span-2">No products. Add them in admin.</p>}
          </div>
        </Card>
      ) : (
        <Card className="p-5 space-y-4">
          {/* selected product header */}
          <div className="flex items-center gap-3">
            <ProductPhoto product={product} className="w-16 h-16 flex-shrink-0 border border-slate-200" />
            <div className="flex-1">
              <div className="font-bold text-slate-800 leading-tight">{product.name}</div>
              <button onClick={() => { setProductId(null); setQty('') }} className="text-sm text-blue-600 font-semibold mt-0.5">← Change product</button>
            </div>
          </div>

          <div>
            <FieldLabel>Good assembled</FieldLabel>
            <div className="mt-1.5"><NumberStepper value={qty} onChange={setQty} quickAdds={QUICK_QTYS} /></div>
          </div>

          <div>
            <FieldLabel>Rejected (defective) — optional</FieldLabel>
            <NumberInput className="mt-1.5" placeholder="0" value={reject} onChange={e => setReject(e.target.value)} />
            {rej > 0 && <p className="text-xs text-amber-600 mt-1">Rejected pieces also used materials — deducted from stock.</p>}
          </div>

          {/* usage preview (good + reject) */}
          {total > 0 && (
            <div className={`rounded-2xl p-4 ${avail && !avail.ok ? 'bg-red-50 border border-red-200' : 'bg-slate-50 border border-slate-200'}`}>
              {!hasRecipe ? (
                <p className="text-sm text-slate-500">No recipe set — saved as a production count only.</p>
              ) : (
                <>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Components used</div>
                  <div className="space-y-1.5">
                    {avail.need.map(item => {
                      const have = stockMap[item.componentId]?.stock ?? 0
                      const short = item.qty > have
                      return (
                        <div key={item.componentId} className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-slate-700">{item.componentName}</span>
                          <span className={short ? 'text-red-600 font-bold' : 'text-slate-600'}>{fmtNum(item.qty)} used · {fmtNum(have)} in stock</span>
                        </div>
                      )
                    })}
                  </div>
                  {avail && !avail.ok && (
                    <div className="mt-3 text-sm font-bold text-red-600">⚠ Short on {avail.short.length} component{avail.short.length > 1 ? 's' : ''}. You can still save.</div>
                  )}
                </>
              )}
            </div>
          )}

          <Button variant="success" size="lg" className="w-full" onClick={save}>Save Production</Button>
        </Card>
      )}

      {/* Today's entries */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <FieldLabel>Entered for {fmtDate(date)}</FieldLabel>
          <span className="text-sm font-bold text-slate-400">{fmtNum(todays.reduce((s, p) => s + (Number(p.qty) || 0), 0))} pcs</span>
        </div>
        {todays.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing entered yet for this date.</p>
        ) : (
          <div className="space-y-2">
            {todays.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                <span className="font-semibold text-slate-700">{p.productName}</span>
                <span className="font-mono font-bold text-emerald-700">× {fmtNum(p.qty)}{p.reject > 0 && <span className="text-red-500 text-xs"> · {fmtNum(p.reject)} rej</span>}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
