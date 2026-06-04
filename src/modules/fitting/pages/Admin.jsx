/**
 * Admin (password-gated) — receive component stock, back up / restore all data,
 * view the audit log, and reset. Receiving stock simply records a receipt, which
 * raises the computed stock for that component.
 */
import { useMemo, useRef, useState } from 'react'
import {
  Button, Card, FieldLabel, PasswordGate, Select, NumberInput, DateInput, TextInput, useToast, Toast,
} from '../../../core/ui'
import { todayStr, fmtDate, fmtNum } from '../../../core/utils/format'
import { useFitting } from '../FittingContext'
import { computeStock } from '../logic/stock'
import { ADMIN_PASSWORD } from '../config'

function ReceiveStock() {
  const { components, receipts, production, log } = useFitting()
  const { msg, show } = useToast()
  const stockMap = useMemo(
    () => computeStock(components.list, receipts.list, production.list),
    [components.list, receipts.list, production.list]
  )
  const sorted = [...components.list].sort((a, b) => a.name.localeCompare(b.name))
  const [componentId, setComponentId] = useState(sorted[0]?.id || '')
  const [qty, setQty] = useState('')
  const [date, setDate] = useState(todayStr())
  const [note, setNote] = useState('')

  const add = () => {
    const c = components.list.find(c => c.id === componentId)
    if (!c) return show('Pick a component', 2000)
    const n = Number(qty) || 0
    if (n <= 0) return show('Enter a quantity', 2000)
    receipts.insert({ date, componentId: c.id, componentName: c.name, qty: n, note: note.trim() })
    log('RECEIVE', `${c.name} +${n} on ${fmtDate(date)}`, 'admin')
    show(`Received ${c.name} +${fmtNum(n)} ✓`)
    setQty(''); setNote('')
  }

  const recent = [...receipts.list].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 8)

  return (
    <Card className="p-5 space-y-3">
      <FieldLabel>Receive Component Stock</FieldLabel>
      {components.list.length === 0 ? (
        <p className="text-sm text-slate-400">Add components first in Components &amp; Recipes.</p>
      ) : (
        <>
          <Select value={componentId} onChange={e => setComponentId(e.target.value)}
            options={sorted.map(c => ({ value: c.id, label: `${c.name} (stock ${fmtNum(stockMap[c.id]?.stock ?? 0)})` }))} />
          <div className="grid grid-cols-2 gap-2">
            <div><FieldLabel>Quantity</FieldLabel><NumberInput className="mt-1" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} /></div>
            <div><FieldLabel>Date</FieldLabel><DateInput className="mt-1" value={date} onChange={e => setDate(e.target.value)} /></div>
          </div>
          <TextInput placeholder="Note (supplier, bill no…) optional" value={note} onChange={e => setNote(e.target.value)} />
          <Button variant="success" className="w-full" onClick={add}>Add to Stock</Button>

          {recent.length > 0 && (
            <div className="pt-2">
              <div className="text-xs font-bold text-slate-400 uppercase mb-2">Recent receipts</div>
              <div className="space-y-1.5">
                {recent.map(r => (
                  <div key={r.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
                    <span className="font-semibold text-slate-700">{r.componentName}</span>
                    <span className="text-slate-500">+{fmtNum(r.qty)} · {fmtDate(r.date)}</span>
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

function DataTools() {
  const { components, products, receipts, production, logs, log } = useFitting()
  const { msg, show } = useToast()
  const fileRef = useRef(null)

  const backup = () => {
    const data = {
      app: 'fitting-assembly', exportedAt: new Date().toISOString(),
      components: components.list, products: products.list,
      receipts: receipts.list, production: production.list, logs: logs.list,
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
    await Promise.all([components.reset(), products.reset(), receipts.reset(), production.reset()])
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
    <PasswordGate password={ADMIN_PASSWORD} title="Admin Area">
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <ReceiveStock />
        <DataTools />
        <Logs />
      </div>
    </PasswordGate>
  )
}
