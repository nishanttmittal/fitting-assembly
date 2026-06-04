/**
 * Admin (password-gated) — receive component stock, back up / restore all data,
 * view the audit log, and reset. Receiving stock simply records a receipt, which
 * raises the computed stock for that component.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button, Card, FieldLabel, Select, NumberInput, DateInput, TextInput, useToast, Toast,
} from '../../../core/ui'
import { todayStr, fmtDate, fmtNum, fmtDec } from '../../../core/utils/format'
import { useFitting } from '../FittingContext'
import { computeStock, piecesFromWeight, weightFromPieces, avgDeviationPct } from '../logic/stock'
import { AVG_WEIGHT_TOLERANCE_PCT } from '../config'

function ReceiveStock() {
  const { components, receipts, production, adjustments, rejects, log } = useFitting()
  const { msg, show } = useToast()
  const stockMap = useMemo(
    () => computeStock(components.list, receipts.list, production.list, adjustments.list, rejects.list),
    [components.list, receipts.list, production.list, adjustments.list, rejects.list]
  )
  const sorted = [...components.list].sort((a, b) => a.name.localeCompare(b.name))
  const [componentId, setComponentId] = useState(sorted[0]?.id || '')
  const [qty, setQty] = useState('')       // pieces (when entering by pieces)
  const [weight, setWeight] = useState('') // weight (when entering by weight)
  const [lotAvg, setLotAvg] = useState('') // THIS lot's avg weight per piece
  const [inputMode, setInputMode] = useState(() => sorted[0]?.measureBy === 'weight' ? 'weight' : 'pieces') // 'pieces' | 'weight'
  const [date, setDate] = useState(todayStr())
  const [source, setSource] = useState('purchased')
  const [note, setNote] = useState('')

  const comp = components.list.find(c => c.id === componentId)
  const byWeight = comp?.measureBy === 'weight'
  const stdAvg = Number(comp?.avgWeight) || 0 // admin-console standard
  const wUnit = comp?.weightUnit || 'kg'

  // Default input mode + prefill this lot's avg weight from the standard,
  // whenever the chosen component changes (avg weight varies lot to lot, so it
  // is always editable per receipt). Manual mode toggles don't reset it.
  useEffect(() => {
    setInputMode(byWeight ? 'weight' : 'pieces')
    setLotAvg(stdAvg > 0 ? String(stdAvg) : '')
  }, [componentId, byWeight, stdAvg])

  const pickComponent = (id) => { setComponentId(id); setQty(''); setWeight('') }

  // Use THIS lot's avg weight for the conversion (fall back to the standard).
  const avg = Number(lotAvg) > 0 ? Number(lotAvg) : stdAvg
  const enteringWeight = byWeight && inputMode === 'weight'
  const pieces = enteringWeight ? piecesFromWeight(avg, weight) : (Number(qty) || 0)
  const expectedWeight = byWeight ? weightFromPieces(avg, pieces) : 0

  // Deviation of this lot's avg weight vs the standard → red flag past tolerance.
  const deviation = byWeight ? avgDeviationPct(stdAvg, avg) : 0
  const flagged = deviation > AVG_WEIGHT_TOLERANCE_PCT

  const add = () => {
    if (!comp) return show('Pick a component', 2000)
    if (byWeight && !(avg > 0)) return show('Enter avg weight for this lot', 2500)
    if (enteringWeight && !(Number(weight) > 0)) return show('Enter a weight', 2000)
    if (!enteringWeight && pieces <= 0) return show('Enter a quantity', 2000)
    if (pieces <= 0) return show('Quantity comes to 0 — check avg weight', 2500)
    const weightVal = byWeight ? (enteringWeight ? Number(weight) || 0 : expectedWeight) : 0
    receipts.insert({
      date, componentId: comp.id, componentName: comp.name, qty: pieces, weight: weightVal,
      avgWeightUsed: byWeight ? avg : 0, flagged, source, sourceApp: 'manual', note: note.trim(),
    })
    log('RECEIVE', `${comp.name} +${pieces}pc${byWeight ? ` (${fmtDec(weightVal)}${wUnit} @ ${fmtDec(avg)}/pc${flagged ? ` ⚠${deviation.toFixed(1)}%` : ''})` : ''} (${source})`, 'admin')
    show(`Added ${comp.name} +${fmtNum(pieces)} pcs ✓`)
    setQty(''); setWeight(''); setNote('')
  }

  const recent = [...receipts.list].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 8)

  return (
    <Card className="p-5 space-y-3">
      <FieldLabel>Incoming Material</FieldLabel>
      <p className="text-xs text-slate-400 -mt-1">Add stock coming in — bought outside or made in-house. (In-house apps can also feed stock here automatically.)</p>
      {components.list.length === 0 ? (
        <p className="text-sm text-slate-400">Add components first in Components &amp; Recipes.</p>
      ) : (
        <>
          <Select value={componentId} onChange={e => pickComponent(e.target.value)}
            options={sorted.map(c => ({ value: c.id, label: `${c.name} (stock ${fmtNum(stockMap[c.id]?.stock ?? 0)})${c.measureBy === 'weight' ? ' ⚖' : ''}` }))} />
          {/* Source toggle */}
          <div className="flex gap-2 bg-slate-100 rounded-2xl p-1">
            {[['purchased', '🛒 Purchased'], ['manufactured', '🏭 Manufactured']].map(([v, label]) => (
              <button key={v} onClick={() => setSource(v)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${source === v ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* For weight materials: choose to enter by weight or by pieces. */}
          {byWeight && (
            <div className="flex gap-2 bg-emerald-50 rounded-2xl p-1">
              {[['weight', `⚖ By weight (${wUnit})`], ['pieces', '🔢 By pieces']].map(([v, label]) => (
                <button key={v} onClick={() => { setInputMode(v); setQty(''); setWeight('') }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${inputMode === v ? 'bg-white shadow text-emerald-700' : 'text-emerald-600/70'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Per-lot average weight (avg weight varies lot to lot) */}
          {byWeight && (
            <div>
              <FieldLabel>Avg weight / piece — this lot ({wUnit})</FieldLabel>
              <NumberInput className={`mt-1 ${flagged ? 'border-red-400 focus:ring-red-200 focus:border-red-500' : ''}`}
                placeholder={stdAvg ? String(stdAvg) : 'e.g. 0.5'} value={lotAvg} onChange={e => setLotAvg(e.target.value)} />
              <div className="mt-1 text-xs">
                {stdAvg > 0 && <span className="text-slate-400">Standard: {fmtDec(stdAvg)} {wUnit}/pc. </span>}
                {flagged
                  ? <span className="text-red-600 font-bold">🚩 {deviation.toFixed(1)}% off standard — please re-verify (still calculated)</span>
                  : (avg > 0 && stdAvg > 0 && deviation > 0)
                    ? <span className="text-emerald-600 font-semibold">✓ within {AVG_WEIGHT_TOLERANCE_PCT}% ({deviation.toFixed(1)}% off)</span>
                    : null}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {enteringWeight ? (
              <div><FieldLabel>Weight ({wUnit})</FieldLabel><NumberInput className="mt-1" placeholder="0" value={weight} onChange={e => setWeight(e.target.value)} /></div>
            ) : (
              <div><FieldLabel>Quantity (pcs)</FieldLabel><NumberInput className="mt-1" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} /></div>
            )}
            <div><FieldLabel>Date</FieldLabel><DateInput className="mt-1" value={date} onChange={e => setDate(e.target.value)} /></div>
          </div>

          {/* Conversion / recheck helper for weight materials */}
          {byWeight && enteringWeight && Number(weight) > 0 && (
            <p className="text-xs text-emerald-700 -mt-1">
              ≈ <b>{fmtNum(pieces)} pcs</b> (from {weight} {wUnit} ÷ {fmtDec(avg)} {wUnit}/pc)
            </p>
          )}
          {byWeight && !enteringWeight && pieces > 0 && (
            <p className="text-xs text-amber-700 -mt-1">
              🔎 Recheck: {fmtNum(pieces)} pcs should weigh ≈ <b>{fmtDec(expectedWeight)} {wUnit}</b> ({fmtNum(pieces)} × {fmtDec(avg)})
            </p>
          )}
          <TextInput placeholder="Note (supplier, bill no…) optional" value={note} onChange={e => setNote(e.target.value)} />
          <Button variant="success" className="w-full" onClick={add}>Add to Stock</Button>

          {recent.length > 0 && (
            <div className="pt-2">
              <div className="text-xs font-bold text-slate-400 uppercase mb-2">Recent incoming</div>
              <div className="space-y-1.5">
                {recent.map(r => (
                  <div key={r.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      {r.flagged && <span title="Lot avg weight off standard">🚩</span>}
                      {r.componentName}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${r.source === 'manufactured' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                        {r.source === 'manufactured' ? 'Made' : 'Bought'}
                      </span>
                      {r.sourceApp && r.sourceApp !== 'manual' && <span className="text-[10px] text-slate-400">via {r.sourceApp}</span>}
                    </span>
                    <span className="text-slate-500">+{fmtNum(r.qty)} pcs{r.weight ? ` · ${fmtDec(r.weight)}kg` : ''} · {fmtDate(r.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

/** Physical stock-take: count actual stock; record the correction (delta). */
function StockTake() {
  const { components, receipts, production, adjustments, rejects, log } = useFitting()
  const { msg, show } = useToast()
  const stockMap = useMemo(
    () => computeStock(components.list, receipts.list, production.list, adjustments.list, rejects.list),
    [components.list, receipts.list, production.list, adjustments.list, rejects.list]
  )
  const sorted = [...components.list].sort((a, b) => a.name.localeCompare(b.name))
  const [componentId, setComponentId] = useState(sorted[0]?.id || '')
  const [counted, setCounted] = useState('')
  const [reason, setReason] = useState('')

  const comp = components.list.find(c => c.id === componentId)
  const systemBefore = stockMap[componentId]?.stock ?? 0
  const delta = (Number(counted) || 0) - systemBefore

  const apply = () => {
    if (!comp) return show('Pick a component', 2000)
    if (counted === '') return show('Enter the counted quantity', 2000)
    if (delta === 0) return show('Counted matches system — no change', 2500)
    adjustments.insert({
      date: todayStr(), componentId: comp.id, componentName: comp.name,
      counted: Number(counted) || 0, systemBefore, delta, reason: reason.trim(),
    })
    log('STOCKTAKE', `${comp.name}: system ${fmtNum(systemBefore)} → counted ${fmtNum(counted)} (${delta > 0 ? '+' : ''}${fmtNum(delta)})${reason ? ' · ' + reason.trim() : ''}`, 'admin')
    show('Stock corrected ✓')
    setCounted(''); setReason('')
  }

  return (
    <Card className="p-5 space-y-3">
      <FieldLabel>Physical Stock-take</FieldLabel>
      <p className="text-xs text-slate-400 -mt-1">Count actual stock and correct the system (breakage, miscount, etc.).</p>
      {components.list.length === 0 ? (
        <p className="text-sm text-slate-400">Add components first.</p>
      ) : (
        <>
          <Select value={componentId} onChange={e => setComponentId(e.target.value)}
            options={sorted.map(c => ({ value: c.id, label: c.name }))} />
          <div className="flex items-center justify-between text-sm bg-slate-50 rounded-xl px-4 py-2.5">
            <span className="text-slate-500">System now</span>
            <span className="font-mono font-bold text-slate-700">{fmtNum(systemBefore)} pcs</span>
          </div>
          <div><FieldLabel>Counted (actual)</FieldLabel><NumberInput className="mt-1" placeholder="0" value={counted} onChange={e => setCounted(e.target.value)} /></div>
          {counted !== '' && (
            <div className={`text-sm font-bold ${delta === 0 ? 'text-slate-500' : delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              Adjustment: {delta > 0 ? '+' : ''}{fmtNum(delta)} pcs
            </div>
          )}
          <TextInput placeholder="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} />
          <Button variant="primary" className="w-full" onClick={apply}>Apply Correction</Button>
        </>
      )}
    </Card>
  )
}

/** Admin-managed list of reject reasons shown to the floor as a dropdown. */
function RejectReasons() {
  const { rejectReasons, log } = useFitting()
  const { msg, show } = useToast()
  const [name, setName] = useState('')
  const add = () => {
    const nm = name.trim()
    if (!nm) return show('Enter a reason', 2000)
    if (rejectReasons.list.some(r => r.name.toLowerCase() === nm.toLowerCase())) return show('Already exists', 2000)
    rejectReasons.insert({ name: nm, order: rejectReasons.list.length })
    log('ADD_REASON', nm, 'admin'); show('Added ✓'); setName('')
  }
  const del = (r) => { rejectReasons.remove(r.id); log('DEL_REASON', r.name, 'admin') }
  return (
    <Card className="p-5 space-y-3">
      <Toast msg={msg} />
      <FieldLabel>Reject Reasons (floor dropdown)</FieldLabel>
      <div className="flex gap-2">
        <TextInput placeholder="New reason" value={name} onChange={e => setName(e.target.value)} />
        <Button variant="primary" onClick={add}>Add</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {rejectReasons.list.map(r => (
          <span key={r.id} className="inline-flex items-center gap-1.5 bg-slate-100 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700">
            {r.name}
            <button onClick={() => del(r)} className="text-red-500 font-bold">✕</button>
          </span>
        ))}
      </div>
    </Card>
  )
}

function DataTools() {
  const { components, products, receipts, production, adjustments, rejects, repairs, dispatch, rejectReasons, logs, log } = useFitting()
  const { msg, show } = useToast()
  const fileRef = useRef(null)

  const backup = () => {
    const data = {
      app: 'fitting', exportedAt: new Date().toISOString(),
      components: components.list, products: products.list,
      receipts: receipts.list, production: production.list,
      adjustments: adjustments.list, rejects: rejects.list,
      repairs: repairs.list, dispatch: dispatch.list, rejectReasons: rejectReasons.list, logs: logs.list,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `fitting-assembly-backup-${todayStr()}.json`
    a.click()
    show('Backup downloaded ✓')
  }

  const restore = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (!confirm('Restore will REPLACE all current data with the backup. Continue?')) return
      await components.replaceAll(data.components || [])
      await products.replaceAll(data.products || [])
      await receipts.replaceAll(data.receipts || [])
      await production.replaceAll(data.production || [])
      await adjustments.replaceAll(data.adjustments || [])
      await rejects.replaceAll(data.rejects || [])
      await repairs.replaceAll(data.repairs || [])
      await dispatch.replaceAll(data.dispatch || [])
      if (data.rejectReasons) await rejectReasons.replaceAll(data.rejectReasons)
      if (logs.replaceAll) await logs.replaceAll(data.logs || [])
      log('RESTORE', `Restored backup from ${file.name}`, 'admin')
      show('Restored ✓ — reopen the app if needed')
    } catch {
      show('Invalid backup file', 3000)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const resetProduction = async () => {
    if (!confirm('Delete ALL production entries? Components & recipes stay. This cannot be undone.')) return
    await production.reset()
    log('RESET', 'Cleared all production', 'admin')
    show('Production cleared ✓')
  }

  const resetAll = async () => {
    if (!confirm('Erase EVERYTHING (components, products, receipts, production)? This cannot be undone.')) return
    await Promise.all([components.reset(), products.reset(), receipts.reset(), production.reset(), adjustments.reset()])
    log('RESET', 'Erased all data', 'admin')
    show('All data erased ✓')
  }

  return (
    <Card className="p-5 space-y-3">
      <Toast msg={msg} />
      <FieldLabel>Backup &amp; Reset</FieldLabel>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={backup}>⬇ Backup</Button>
        <Button variant="neutral" onClick={() => fileRef.current?.click()}>⬆ Restore</Button>
      </div>
      <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={restore} />
      <Button variant="danger" className="w-full" onClick={resetProduction}>Clear all production</Button>
      <Button variant="danger" className="w-full" onClick={resetAll}>Erase everything</Button>
    </Card>
  )
}

function Logs() {
  const { logs } = useFitting()
  const recent = [...logs.list].sort((a, b) => (b.ts || '').localeCompare(a.ts || '')).slice(0, 40)
  return (
    <Card className="p-5">
      <FieldLabel>Activity Log</FieldLabel>
      {recent.length === 0 ? (
        <p className="text-sm text-slate-400 mt-3">No activity yet.</p>
      ) : (
        <div className="mt-3 space-y-1.5 max-h-80 overflow-auto">
          {recent.map((l, i) => (
            <div key={l.id || i} className="text-xs bg-slate-50 rounded-lg px-3 py-2">
              <span className="font-bold text-slate-600">{l.action}</span>
              <span className="text-slate-500"> · {l.detail}</span>
              <div className="text-slate-300">{new Date(l.ts).toLocaleString('en-IN')}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function Admin() {
  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <ReceiveStock />
      <StockTake />
      <RejectReasons />
      <DataTools />
      <Logs />
    </div>
  )
}
