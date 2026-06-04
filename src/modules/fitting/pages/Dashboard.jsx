/**
 * Dashboard — at-a-glance view for the owner.
 *   • Today's production per product
 *   • Component stock (low / short highlighted)
 *   • How many of each product can still be built from current stock
 *   • Shortage alerts
 */
import { useMemo, useState } from 'react'
import { Card, FieldLabel } from '../../../core/ui'
import { todayStr, fmtDate, fmtNum, fmtDec } from '../../../core/utils/format'
import { useFitting } from '../FittingContext'
import { computeStock, canBuild, shortages, incomingSummary, reorderList, inventoryValue } from '../logic/stock'
import { SourceBadge } from './Setup'
import ProductPhoto from '../components/ProductPhoto'

function Stat({ label, value, tone = 'text-slate-800' }) {
  return (
    <Card className="p-4 flex-1 text-center">
      <div className={`text-3xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </Card>
  )
}

export default function Dashboard() {
  const { components, products, receipts, production, adjustments } = useFitting()
  const [date, setDate] = useState(todayStr())

  const stockMap = useMemo(
    () => computeStock(components.list, receipts.list, production.list, adjustments.list),
    [components.list, receipts.list, production.list, adjustments.list]
  )
  const stockList = useMemo(
    () => Object.values(stockMap).sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name)),
    [stockMap]
  )
  const short = shortages(stockMap)
  const reorders = useMemo(() => reorderList(stockMap), [stockMap])
  const invValue = useMemo(() => inventoryValue(stockMap), [stockMap])

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

  // Material received this month, split by where it came from.
  const monthFrom = todayStr().slice(0, 8) + '01'
  const incoming = useMemo(() => incomingSummary(receipts.list, monthFrom, todayStr()), [receipts.list, monthFrom])

  // Per-product production today and this month (for target tracking).
  const ym = todayStr().slice(0, 7)
  const prodToday = useMemo(() => {
    const m = {}; production.list.filter(p => p.date === todayStr()).forEach(p => { m[p.productId] = (m[p.productId] || 0) + (Number(p.qty) || 0) }); return m
  }, [production.list])
  const prodMonth = useMemo(() => {
    const m = {}; production.list.filter(p => (p.date || '').slice(0, 7) === ym).forEach(p => { m[p.productId] = (m[p.productId] || 0) + (Number(p.qty) || 0) }); return m
  }, [production.list, ym])
  const targetProducts = sortedProducts.filter(p => p.targetDay > 0 || p.targetMonth > 0)

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex gap-3">
        <Stat label="Made (selected day)" value={fmtNum(totalDay)} tone="text-emerald-600" />
        <Stat label="To order" value={reorders.length} tone={reorders.length ? 'text-red-600' : 'text-slate-800'} />
        <Stat label="Short" value={short.length} tone={short.length ? 'text-red-600' : 'text-slate-800'} />
      </div>

      {invValue > 0 && (
        <Card className="p-4 flex items-center justify-between">
          <FieldLabel>Inventory Value (materials)</FieldLabel>
          <span className="text-xl font-bold text-slate-800">₹{fmtNum(invValue)}</span>
        </Card>
      )}

      {/* Order Now — materials at/below reorder level */}
      {reorders.length > 0 && (
        <Card className="p-5 border border-red-200 bg-red-50">
          <FieldLabel className="text-red-600">🛒 Order Now ({reorders.length})</FieldLabel>
          <div className="mt-3 space-y-2">
            {reorders.map(s => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold text-slate-800">{s.name}</div>
                  <div className="text-xs text-slate-500">
                    {fmtNum(s.stock)} left · reorder at {fmtNum(s.reorderLevel)}
                    {s.supplierName ? ` · ${s.supplierName}` : ''}{s.supplierPhone ? ` ☎ ${s.supplierPhone}` : ''}
                    {s.leadTimeDays > 0 ? ` · ${fmtNum(s.leadTimeDays)}d lead` : ''}
                  </div>
                </div>
                <span className="font-bold text-red-600 whitespace-nowrap">order ~{fmtNum(Math.max(s.shortfall, s.reorderLevel))}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

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

      {/* Material received this month, by source */}
      <Card className="p-5">
        <FieldLabel>Material In · This Month</FieldLabel>
        <div className="mt-3 flex gap-3">
          <div className="flex-1 bg-sky-50 rounded-xl px-4 py-3 text-center">
            <div className="text-2xl font-bold text-sky-700">{fmtNum(incoming.purchased)}</div>
            <div className="text-xs text-sky-600 mt-0.5">🛒 Purchased</div>
          </div>
          <div className="flex-1 bg-amber-50 rounded-xl px-4 py-3 text-center">
            <div className="text-2xl font-bold text-amber-700">{fmtNum(incoming.manufactured)}</div>
            <div className="text-xs text-amber-600 mt-0.5">🏭 Manufactured</div>
          </div>
        </div>
      </Card>

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

      {/* Production vs targets */}
      {targetProducts.length > 0 && (
        <Card className="p-5">
          <FieldLabel>Targets · Today &amp; This Month</FieldLabel>
          <div className="mt-3 space-y-3">
            {targetProducts.map(p => {
              const td = prodToday[p.id] || 0, tm = prodMonth[p.id] || 0
              const Bar = ({ done, goal, tone }) => {
                const pct = goal > 0 ? Math.min(100, Math.round(done / goal * 100)) : 0
                return (
                  <div className="flex-1">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${tone}`} style={{ width: `${pct}%` }} /></div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{fmtNum(done)}/{fmtNum(goal)} ({pct}%)</div>
                  </div>
                )
              }
              return (
                <div key={p.id}>
                  <div className="text-sm font-semibold text-slate-700 mb-1">{p.name}</div>
                  <div className="flex gap-3">
                    {p.targetDay > 0 && <div className="flex-1"><div className="text-[10px] uppercase font-bold text-slate-400">Day</div><Bar done={td} goal={p.targetDay} tone="bg-emerald-500" /></div>}
                    {p.targetMonth > 0 && <div className="flex-1"><div className="text-[10px] uppercase font-bold text-slate-400">Month</div><Bar done={tm} goal={p.targetMonth} tone="bg-blue-500" /></div>}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

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
                  <div className="font-semibold text-slate-700 flex items-center gap-1.5">{s.name} <SourceBadge source={s.source} />{s.measureBy === 'weight' && <span className="text-[10px] text-emerald-600">⚖</span>}</div>
                  <div className="text-xs text-slate-400">in {fmtNum(s.received)} · used {fmtNum(s.used)}</div>
                </div>
                <span className={`font-mono font-bold text-right ${s.negative ? 'text-red-600' : s.low ? 'text-amber-600' : 'text-slate-700'}`}>
                  {fmtNum(s.stock)} {s.unit}
                  {s.measureBy === 'weight' && s.avgWeight > 0 && (
                    <div className="text-[11px] font-semibold text-slate-400">≈ {fmtDec(s.stock * s.avgWeight)} {s.weightUnit}</div>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
