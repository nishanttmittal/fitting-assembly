/**
 * Enter Production — the floor worker's screen. Deliberately minimal (fewer
 * taps = fewer mistakes) and shows NO stock to the worker:
 *   1. Date — defaults to today; floor may back-date only a few days, admin any date
 *   2. Tap the product's PHOTO
 *   3. Good qty + Rejected qty (+ reason) + optional remarks → big SAVE
 * Saving snapshots the components consumed (good + reject) and deducts stock.
 */
import { useMemo, useState } from 'react'
import { Button, Card, FieldLabel, NumberInput, NumberStepper, SearchBar, Select, TextInput, useToast, Toast } from '../../../core/ui'
import { todayStr, daysAgoStr, fmtNum, fmtDate } from '../../../core/utils/format'
import { useFitting } from '../FittingContext'
import { QUICK_QTYS, FLOOR_BACKDATE_DAYS } from '../config'
import { consumedFor } from '../logic/stock'
import ProductPhoto from '../components/ProductPhoto'

export default function NewProduction({ floor = false }) {
  const { products, components, production, rejectReasons, log, lastUsed } = useFitting()
  const { msg, show } = useToast()

  const sortedProducts = useMemo(
    () => [...products.list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)),
    [products.list]
  )

  const [date, setDate] = useState(todayStr())
  const [productId, setProductId] = useState(null)
  const [qty, setQty] = useState('')
  const [reject, setReject] = useState('')
  const [reason, setReason] = useState('')
  const [remarks, setRemarks] = useState('')
  const [search, setSearch] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [fixing, setFixing] = useState(null)   // the last entry being corrected
  const [fixQty, setFixQty] = useState('')

  const product = sortedProducts.find(p => p.id === productId)
  const n = Number(qty) || 0
  const rej = Number(reject) || 0
  const total = n + rej

  const reasonOpts = [{ value: '', label: '— select reason —' }, ...rejectReasons.list.map(r => ({ value: r.name, label: r.name }))]

  const todays = production.list
    .filter(p => p.date === date)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  // Duplicate-entry guard: how much was already entered today for this product.
  const alreadyToday = product
    ? todays.filter(p => p.productId === product.id).reduce((s, p) => s + (Number(p.qty) || 0), 0)
    : 0

  // Worker self-correction: only the MOST RECENT entry, and only when the
  // screen is on today, can the worker fix/cancel. Older entries lock (admin only).
  const editableId = date === todayStr() ? todays[0]?.id : null

  const openFix = (p) => { setFixing(p); setFixQty(String(p.qty)) }
  const saveFix = () => {
    const newGood = Number(fixQty) || 0
    const pr = products.list.find(x => x.id === fixing.productId)
    const consumed = pr ? consumedFor(pr, newGood + (Number(fixing.reject) || 0), components.list) : (fixing.consumed || [])
    production.update(fixing.id, { qty: newGood, consumed })
    log('FIX', `${fixing.productName}: ${fixing.qty}→${newGood} (worker, same-day)`, floor ? 'floor' : 'admin')
    show('Corrected ✓'); setFixing(null)
  }
  const cancelEntry = (p) => {
    if (!confirm(`Cancel this entry (${p.productName} × ${p.qty})? It will be voided to 0.`)) return
    production.update(p.id, { qty: 0, reject: 0, consumed: [] })
    log('VOID', `${p.productName} × ${p.qty} → 0 (worker cancel)`, floor ? 'floor' : 'admin')
    show('Entry cancelled ✓')
  }

  const term = search.trim().toLowerCase()
  const tiles = sortedProducts.filter(p => !term || p.name.toLowerCase().includes(term))

  const pick = (id) => { setProductId(id); setQty(''); setReject(''); setReason(''); setRemarks('') }

  // Validate, then ask for confirmation (mistake-proofing).
  const requestSave = () => {
    if (!product) return show('Pick a product first', 2000)
    if (total <= 0) return show('Enter a quantity', 2000)
    setConfirming(true)
  }

  const doSave = () => {
    setConfirming(false)
    const consumed = consumedFor(product, total, components.list) // good + reject use materials
    production.insert({
      date, productId: product.id, productName: product.name,
      qty: n, reject: rej, rejectReason: rej > 0 ? reason : '', remarks: remarks.trim(), consumed,
    })
    log('PRODUCE', `${product.name} × ${n}${rej ? ` (+${rej} reject${reason ? ' · ' + reason : ''})` : ''} on ${fmtDate(date)}`, floor ? 'floor' : 'admin')
    lastUsed.set({ ...lastUsed.get(), productId: product.id })
    show(`Saved: ${product.name} × ${fmtNum(n)} ✓`)
    setQty(''); setReject(''); setReason(''); setRemarks('')
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />

      {/* 1. Date */}
      <Card className="p-4">
        <FieldLabel>Date</FieldLabel>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          min={floor ? daysAgoStr(FLOOR_BACKDATE_DAYS) : undefined} max={floor ? todayStr() : undefined}
          className="mt-1.5 w-full border-2 border-slate-300 rounded-2xl px-4 py-3 text-base font-semibold focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-500" />
        {floor && <p className="text-xs text-slate-400 mt-1">Today by default. Older dates: ask admin.</p>}
      </Card>

      {/* 2. Pick product OR 3. enter for the picked one */}
      {!product ? (
        <Card className="p-4 space-y-3">
          <FieldLabel>Tap the product</FieldLabel>
          {sortedProducts.length > 6 && <SearchBar value={search} onChange={setSearch} placeholder="Search product…" />}
          <div className="grid grid-cols-2 gap-3">
            {tiles.map(p => (
              <button key={p.id} onClick={() => pick(p.id)}
                className="bg-white border-2 border-slate-200 rounded-2xl p-2 flex flex-col items-center gap-1.5 active:scale-95 transition-transform hover:border-blue-300">
                <ProductPhoto product={p} className="w-full h-28" />
                <span className="text-sm font-bold text-slate-700 text-center leading-tight line-clamp-2">{p.name}</span>
              </button>
            ))}
            {tiles.length === 0 && <p className="text-sm text-slate-400 col-span-2">No products.</p>}
          </div>
        </Card>
      ) : (
        <Card className="p-5 space-y-4">
          {/* selected product */}
          <div className="flex items-center gap-3">
            <ProductPhoto product={product} className="w-20 h-20 flex-shrink-0 border border-slate-200" />
            <div className="flex-1">
              <div className="font-bold text-slate-800 text-lg leading-tight">{product.name}</div>
              <button onClick={() => pick(null)} className="text-sm text-blue-600 font-semibold mt-1">← Change product</button>
            </div>
          </div>

          {alreadyToday > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 font-semibold">
              ⚠ Already entered <b>{fmtNum(alreadyToday)} pcs</b> for this product on {fmtDate(date)}. Only add MORE if this is a new batch.
            </div>
          )}

          <div>
            <FieldLabel>Good Qty</FieldLabel>
            <div className="mt-1.5"><NumberStepper value={qty} onChange={setQty} quickAdds={QUICK_QTYS} /></div>
          </div>

          <div>
            <FieldLabel>Rejected Qty</FieldLabel>
            <NumberInput className="mt-1.5" placeholder="0" value={reject} onChange={e => setReject(e.target.value)} />
          </div>

          {rej > 0 && (
            <div>
              <FieldLabel>Reject reason</FieldLabel>
              <Select className="mt-1.5" value={reason} onChange={e => setReason(e.target.value)} options={reasonOpts} />
            </div>
          )}

          <div>
            <FieldLabel>Remarks (optional)</FieldLabel>
            <TextInput className="mt-1.5" placeholder="Any note…" value={remarks} onChange={e => setRemarks(e.target.value)} />
          </div>

          <Button variant="success" size="lg" className="w-full text-lg py-5" onClick={requestSave}>SAVE</Button>
        </Card>
      )}

      {/* Confirmation popup (mistake-proofing) */}
      {confirming && product && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5" onClick={() => setConfirming(false)}>
          <Card className="p-6 w-full max-w-sm text-center space-y-4" onClick={e => e.stopPropagation()}>
            <ProductPhoto product={product} className="w-24 h-24 mx-auto border border-slate-200" />
            <div className="text-lg font-bold text-slate-800">Save this entry?</div>
            <div className="text-2xl font-bold text-emerald-600">{fmtNum(n)} good{rej > 0 ? <span className="text-red-500"> · {fmtNum(rej)} rejected</span> : null}</div>
            <div className="text-sm font-semibold text-slate-600">{product.name}<br />{fmtDate(date)}</div>
            <div className="flex gap-3 pt-1">
              <Button variant="ghost" className="flex-1" onClick={() => setConfirming(false)}>Cancel</Button>
              <Button variant="success" className="flex-1" onClick={doSave}>Yes, Save</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Today's entries (view only) */}
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
              <div key={p.id} className="bg-slate-50 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className={`font-semibold ${p.qty === 0 ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{p.productName}</span>
                  <span className={`font-mono font-bold ${p.qty === 0 ? 'text-slate-400' : 'text-emerald-700'}`}>
                    {p.qty === 0 ? 'cancelled' : <>× {fmtNum(p.qty)}{p.reject > 0 && <span className="text-red-500 text-xs"> · {fmtNum(p.reject)} rej</span>}</>}
                  </span>
                </div>
                {p.id === editableId && p.qty > 0 && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => openFix(p)} className="flex-1 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg py-1.5">✎ Fix qty</button>
                    <button onClick={() => cancelEntry(p)} className="flex-1 text-xs font-bold text-red-600 bg-red-50 rounded-lg py-1.5">✕ Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Fix-last-entry modal (worker, same-day) */}
      {fixing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5" onClick={() => setFixing(null)}>
          <Card className="p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <FieldLabel>Fix last entry · {fixing.productName}</FieldLabel>
            <div>
              <FieldLabel>Good Qty</FieldLabel>
              <div className="mt-1.5"><NumberStepper value={fixQty} onChange={setFixQty} quickAdds={QUICK_QTYS} /></div>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setFixing(null)}>Cancel</Button>
              <Button variant="success" className="flex-1" onClick={saveFix}>Save</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
