/**
 * Dashboard — at-a-glance view for the owner.
 *   • Today's production per product
 *   • Component stock (low / short highlighted)
 *   • How many of each product can still be built from current stock
 *   • Shortage alerts
 */
import { useMemo, useState } from 'react'
import { Card, FieldLabel } from '../../../core/ui'
import { todayStr, fmtDate, fmtNum } from '../../../core/utils/format'
import { useFitting } from '../FittingContext'
import { computeStock, canBuild, shortages } from '../logic/stock'

function Stat({ label, value, tone = 'text-slate-800' }) {
  return (
    <Card className="p-4 flex-1 text-center">
      <div className={`text-3xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </Card>
  )
}

export default function Dashboard() {
  const { components, products, receipts, production } = useFitting()
  const [date, setDate] = useState(todayStr())

  const stockMap = useMemo(
    () => computeStock(components.list, receipts.list, production.list),
    [components.list, receipts.list, production.list]
  )
  const stockList = useMemo(
    () => Object.values(stockMap).sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name)),
    [stockMap]
  )
  const short = shortages(stockMap)

  const sortedProducts = useMemo(
    () => [...products.list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)),
    [products.list]
  )

  // Production for the chosen date, grouped by product.
  const dayProd = useMemo(() => {
    const m = {}
    for (const p of production.list.filter(p => p.date === date)) {
      m[p.productName] = (m[p.productName] || 0) + (Number(p.qty) || 0)
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [production.list, date])

  const totalDay = dayProd.reduce((s, [, q]) => s + q, 0)

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex gap-3">
        <Stat label="Made (selected day)" value={fmtNum(totalDay)} tone="text-emerald-600" />
        <Stat label="Components" value={components.list.length} />
        <Stat label="Short" value={short.length} tone={short.length ? 'text-red-600' : 'text-slate-800'} />
      </div>

      {/* Shortage alerts */}
      {short.length > 0 && (
        <Card className="p-5 border border-red-200 bg-red-50">
          <FieldLabel className="text-red-600">⚠ Shortage Alerts</FieldLabel>
          <div className="mt-3 space-y-2">
            {short.map(s => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-800">{s.name}</span>
                <span className={`font-bold ${s.negative ? 'text-red-600' : 'text-amber-600'}`}>
                  {s.negative ? `${fmtNum(s.stock)} (over-used)` : `${fmtNum(s.stock)} ${s.unit} left — low`}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Production for a chosen date */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <FieldLabel>Production</FieldLabel>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border-2 border-slate-200 rounded-xl px-3 py-1.5 text-sm font-semibold" />
        </div>
        {dayProd.length === 0 ? (
          <p className="text-sm text-slate-400">No production recorded on {fmtDate(date)}.</p>
        ) : (
          <div className="space-y-2">
            {dayProd.map(([name, q]) => (
              <div key={name} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                <span className="font-semibold text-slate-700">{name}</span>
                <span className="font-mono font-bold text-emerald-700">× {fmtNum(q)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Can-build per product */}
      <Card className="p-5">
        <FieldLabel>Can Build Now (from stock)</FieldLabel>
        <div className="mt-3 space-y-2">
          {sortedProducts.map(p => {
            const cb = canBuild(p, stockMap)
            return (
              <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                <span className="font-semibold text-slate-700">{p.name}</span>
                {cb === null
                  ? <span className="text-xs text-slate-400">no recipe</span>
                  : <span className={`font-mono font-bold ${cb === 0 ? 'text-red-600' : 'text-blue-700'}`}>{fmtNum(cb)} pcs</span>}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Full component stock */}
      <Card className="p-5">
        <FieldLabel>Component Stock</FieldLabel>
        {stockList.length === 0 ? (
          <p className="text-sm text-slate-400 mt-3">No components yet. Add them in Components &amp; Recipes.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {stockList.map(s => (
              <div key={s.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                <div>
                  <div className="font-semibold text-slate-700">{s.name}</div>
                  <div className="text-xs text-slate-400">in {fmtNum(s.received)} · used {fmtNum(s.used)}</div>
                </div>
                <span className={`font-mono font-bold ${s.negative ? 'text-red-600' : s.low ? 'text-amber-600' : 'text-slate-700'}`}>
                  {fmtNum(s.stock)} {s.unit}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
