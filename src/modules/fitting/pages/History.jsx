/**
 * History (admin) — review past production. Audit policy:
 *   • Edit qty/date — logged old→new against the entry.
 *   • Void — sets qty to 0 with a reason (no data lost); the entry stays as a
 *     struck-through record. This is the normal "remove".
 *   • Hard Delete — actually removes the row; requires the admin password.
 * Every change is logged with the entry id, and each entry shows its own
 * edit-history (old→new, by whom, time).
 */
import { useMemo, useState } from 'react'
import { Button, Card, FieldLabel, SearchBar, NumberStepper, DateInput, useToast, Toast } from '../../../core/ui'
import { fmtDate, fmtNum } from '../../../core/utils/format'
import { useFitting } from '../FittingContext'
import { consumedFor } from '../logic/stock'

export default function History() {
  const { products, components, production, logs, log } = useFitting()
  const { msg, show } = useToast()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [editQty, setEditQty] = useState('')
  const [editDate, setEditDate] = useState('')
  const [historyOf, setHistoryOf] = useState(null) // entry id whose history is open

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return production.list
      .filter(p => !term || (p.productName || '').toLowerCase().includes(term) || (p.date || '').includes(term))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''))
  }, [production.list, q])

  const recompute = (entry, newQty) => {
    const product = products.list.find(pr => pr.id === entry.productId)
    if (product) return consumedFor(product, newQty + (Number(entry.reject) || 0), components.list)
    const factor = (Number(entry.qty) || 1) ? newQty / (Number(entry.qty) || 1) : 0
    return (entry.consumed || []).map(c => ({ ...c, qty: (Number(c.qty) || 0) * factor }))
  }

  const startEdit = (p) => { setEditing(p); setEditQty(String(p.qty)); setEditDate(p.date) }
  const saveEdit = () => {
    const newQty = Number(editQty) || 0
    production.update(editing.id, { qty: newQty, date: editDate, consumed: recompute(editing, newQty) })
    log('EDIT', `${editing.productName}: ${editing.qty}→${newQty}${editDate !== editing.date ? ` · date ${fmtDate(editing.date)}→${fmtDate(editDate)}` : ''}`, 'admin', editing.id)
    show('Updated ✓'); setEditing(null)
  }

  const voidEntry = (p) => {
    const reason = prompt(`Void "${p.productName} × ${p.qty}" (set to 0)?\nReason:`)
    if (reason === null) return
    production.update(p.id, { qty: 0, reject: 0, consumed: [] })
    log('VOID', `${p.productName} × ${p.qty} → 0${reason ? ' · ' + reason : ''}`, 'admin', p.id)
    show('Voided ✓')
  }

  const hardDelete = (p) => {
    if (!confirm(`HARD DELETE "${p.productName} × ${p.qty}"?\nThis removes it permanently and cannot be undone.`)) return
    log('DELETE', `${p.productName} × ${p.qty} on ${fmtDate(p.date)} (hard delete)`, 'admin', p.id)
    production.remove(p.id)
    show('Deleted ✓')
  }

  const entryHistory = (id) => logs.list.filter(l => l.ref === id).sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />
      <SearchBar value={q} onChange={setQ} placeholder="Search product or date (2026-06)…" />

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-slate-400">No entries found.</Card>
      ) : (
        <div className="space-y-2">
          {rows.map(p => {
            const voided = p.qty === 0
            const hist = entryHistory(p.id)
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`font-bold ${voided ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{p.productName}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{fmtDate(p.date)}{p.operator ? ` · ${p.operator}` : ''}{p.reject > 0 ? ` · ${fmtNum(p.reject)} rej` : ''}</div>
                  </div>
                  <span className={`font-mono font-bold text-lg ${voided ? 'text-slate-400' : 'text-emerald-700'}`}>{voided ? 'void' : `× ${fmtNum(p.qty)}`}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="neutral" className="flex-1" onClick={() => startEdit(p)}>Edit</Button>
                  {!voided && <Button size="sm" variant="ghost" className="flex-1" onClick={() => voidEntry(p)}>Void</Button>}
                  <Button size="sm" variant="danger" className="flex-1" onClick={() => hardDelete(p)}>Delete</Button>
                </div>
                {hist.length > 0 && (
                  <div className="mt-2">
                    <button onClick={() => setHistoryOf(historyOf === p.id ? null : p.id)} className="text-xs font-bold text-blue-600">
                      {historyOf === p.id ? 'Hide' : `History (${hist.length})`}
                    </button>
                    {historyOf === p.id && (
                      <div className="mt-1.5 space-y-1">
                        {hist.map((l, i) => (
                          <div key={l.id || i} className="text-[11px] bg-slate-50 rounded px-2 py-1 text-slate-500">
                            <b className="text-slate-600">{l.action}</b> {l.detail} · {l.by} · {new Date(l.ts).toLocaleString('en-IN')}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-40 p-4" onClick={() => setEditing(null)}>
          <Card className="p-5 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <FieldLabel>Edit · {editing.productName}</FieldLabel>
            <div><FieldLabel>Date</FieldLabel><DateInput className="mt-1.5" value={editDate} onChange={e => setEditDate(e.target.value)} /></div>
            <div><FieldLabel>Good Qty</FieldLabel><div className="mt-1.5"><NumberStepper value={editQty} onChange={setEditQty} /></div></div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="success" className="flex-1" onClick={saveEdit}>Save</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
