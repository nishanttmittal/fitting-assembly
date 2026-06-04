/**
 * Enter Production — the floor worker's main screen.
 * Pick one product → enter quantity → see the components it will use and any
 * shortage → Save. Saving snapshots the consumed components and deducts stock
 * (stock is recomputed from this entry). Designed for one-at-a-time entry.
 */
import { useMemo, useState } from 'react'
import { Button, Card, FieldLabel, Select, NumberStepper, useToast, Toast } from '../../../core/ui'
import { todayStr, fmtNum, fmtDate } from '../../../core/utils/format'
import { useFitting } from '../FittingContext'
import { QUICK_QTYS } from '../config'
import { computeStock, consumedFor, checkAvailability, recipeOf } from '../logic/stock'

export default function NewProduction() {
  const { components, products, receipts, production, log, lastUsed } = useFitting()
  const { msg, show } = useToast()

  const sortedProducts = useMemo(
    () => [...products.list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)),
    [products.list]
  )

  const remembered = lastUsed.get().productId
  const [productId, setProductId] = useState(remembered || sortedProducts[0]?.id || '')
  const [date, setDate] = useState(todayStr())
  const [qty, setQty] = useState('')

  const product = sortedProducts.find(p => p.id === productId)
  const stockMap = useMemo(
    () => computeStock(components.list, receipts.list, production.list),
    [components.list, receipts.list, production.list]
  )
  const n = Number(qty) || 0
  const avail = product && n > 0 ? checkAvailability(product, n, components.list, stockMap) : null
  const hasRecipe = recipeOf(product).length > 0

  const todays = production.list
    .filter(p => p.date === date)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  const save = () => {
    if (!product) return show('Pick a product first', 2000)
    if (n <= 0) return show('Enter a quantity', 2000)
    const consumed = consumedFor(product, n, components.list)
    production.insert({ date, productId: product.id, productName: product.name, qty: n, consumed })
    log('PRODUCE', `${product.name} × ${n} on ${fmtDate(date)}`)
    lastUsed.set({ ...lastUsed.get(), productId: product.id })
    show(`Saved: ${product.name} × ${fmtNum(n)} ✓`)
    setQty('')
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />

      <Card className="p-5 space-y-4">
        <div>
          <FieldLabel>Product</FieldLabel>
          <Select className="mt-1.5" value={productId}
            onChange={e => setProductId(e.target.value)}
            options={sortedProducts.map(p => ({ value: p.id, label: p.name }))} />
        </div>

        <div>
          <FieldLabel>Date</FieldLabel>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="mt-1.5 w-full border-2 border-slate-300 rounded-2xl px-4 py-3 text-base font-semibold focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-500" />
        </div>

        <div>
          <FieldLabel>Quantity assembled</FieldLabel>
          <div className="mt-1.5">
            <NumberStepper value={qty} onChange={setQty} quickAdds={QUICK_QTYS} />
          </div>
        </div>

        {/* Live component-usage preview */}
        {n > 0 && product && (
          <div className={`rounded-2xl p-4 ${avail && !avail.ok ? 'bg-red-50 border border-red-200' : 'bg-slate-50 border border-slate-200'}`}>
            {!hasRecipe ? (
              <p className="text-sm text-slate-500">
                No recipe set for <b>{product.name}</b> yet — it will be saved as a production count only.
                Add its components in <b>Components &amp; Recipes</b> to track stock.
              </p>
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
                        <span className={short ? 'text-red-600 font-bold' : 'text-slate-600'}>
                          {fmtNum(item.qty)} used · {fmtNum(have)} in stock
                        </span>
                      </div>
                    )
                  })}
                </div>
                {avail && !avail.ok && (
                  <div className="mt-3 text-sm font-bold text-red-600">
                    ⚠ Short on {avail.short.length} component{avail.short.length > 1 ? 's' : ''}. You can still save — record receipts to fix stock.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <Button variant="success" size="lg" className="w-full" onClick={save}>
          Save Production
        </Button>
      </Card>

      {/* Today's entries (confirmation) */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <FieldLabel>Entered for {fmtDate(date)}</FieldLabel>
          <span className="text-sm font-bold text-slate-400">
            {fmtNum(todays.reduce((s, p) => s + (Number(p.qty) || 0), 0))} pcs
          </span>
        </div>
        {todays.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing entered yet for this date.</p>
        ) : (
          <div className="space-y-2">
            {todays.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                <span className="font-semibold text-slate-700">{p.productName}</span>
                <span className="font-mono font-bold text-emerald-700">× {fmtNum(p.qty)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
