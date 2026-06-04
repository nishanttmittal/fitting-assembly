/**
 * History — browse past production entries; edit quantity/date or delete.
 * Because stock is computed from production, editing or deleting an entry
 * automatically corrects component stock. Edits re-snapshot the consumed
 * components from the product's current recipe (falling back to proportional
 * scaling if the product was removed).
 */
import { useMemo, useState } from 'react'
import { Button, Card, FieldLabel, SearchBar, NumberStepper, DateInput, useToast, Toast } from '../../../core/ui'
import { fmtDate, fmtNum } from '../../../core/utils/format'
import { useFitting } from '../FittingContext'
import { consumedFor } from '../logic/stock'

export default function History() {
  const { products, components, production, log } = useFitting()
  const { msg, show } = useToast()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null) // entry being edited
  const [editQty, setEditQty] = useState('')
  const [editDate, setEditDate] = useState('')

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return production.list
      .filter(p => !term || (p.productName || '').toLowerCase().includes(term) || (p.date || '').includes(term))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''))
  }, [production.list, q])

  const startEdit = (p) => { setEditing(p); setEditQty(String(p.qty)); setEditDate(p.date) }

  const saveEdit = () => {
    const newQty = Number(editQty) || 0
    if (newQty <= 0) return show('Quantity must be more than 0', 2000)
    const product = products.list.find(pr => pr.id === editing.productId)
    let consumed
    if (product) {
      consumed = consumedFor(product, newQty, components.list)
    } else {
      // product removed — scale the original snapshot proportionally
      const factor = (Number(editing.qty) || 1) ? newQty / (Number(editing.qty) || 1) : 0
      consumed = (editing.consumed || []).map(c => ({ ...c, qty: (Number(c.qty) || 0) * factor }))
    }
    production.update(editing.id, { qty: newQty, date: editDate, consumed })
    log('EDIT', `${editing.productName}: ${editing.qty}→${newQty} on ${fmtDate(editDate)}`)
    show('Updated ✓')
    setEditing(null)
  }

  const del = (p) => {
    if (!confirm(`Delete ${p.productName} × ${p.qty} (${fmtDate(p.date)})? Stock will be restored.`)) return
    production.remove(p.id)
    log('DELETE', `${p.productName} × ${p.qty} on ${fmtDate(p.date)}`)
    show('Deleted ✓')
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />
      <SearchBar value={q} onChange={setQ} placeholder="Search product or date (2026-06)…" />

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-slate-400">No entries found.</Card>
      ) : (
        <div className="space-y-2">
          {rows.map(p => (
            <Card key={p.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">{p.productName}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{fmtDate(p.date)} · {(p.consumed || []).length} component(s) used</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-emerald-700 text-lg">× {fmtNum(p.qty)}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="neutral" className="flex-1" onClick={() => startEdit(p)}>Edit</Button>
                <Button size="sm" variant="danger" className="flex-1" onClick={() => del(p)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit sheet */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-40 p-4" onClick={() => setEditing(null)}>
          <Card className="p-5 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <FieldLabel>Edit · {editing.productName}</FieldLabel>
            <div>
              <FieldLabel>Date</FieldLabel>
              <DateInput className="mt-1.5" value={editDate} onChange={e => setEditDate(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Quantity</FieldLabel>
              <div className="mt-1.5"><NumberStepper value={editQty} onChange={setEditQty} /></div>
            </div>
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
