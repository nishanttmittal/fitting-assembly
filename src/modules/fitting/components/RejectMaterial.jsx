/**
 * RejectMaterial — report a defective raw part that's scrapped, reducing its
 * stock. Shared by the shop floor (by='floor') and admin (by='admin'). Each
 * reject is recorded in the `rejects` collection and folded into stock by
 * computeStock (stock = received − used + adjustments − rejects).
 */
import { useState } from 'react'
import { Button, Card, FieldLabel, Select, NumberInput, TextInput, useToast, Toast } from '../../../core/ui'
import { todayStr, fmtNum } from '../../../core/utils/format'
import { useFitting } from '../FittingContext'

export default function RejectMaterial({ by = 'floor' }) {
  const { components, rejects, log } = useFitting()
  const { msg, show } = useToast()
  const sorted = [...components.list].sort((a, b) => a.name.localeCompare(b.name))
  const [componentId, setComponentId] = useState(sorted[0]?.id || '')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')

  const comp = components.list.find(c => c.id === componentId)

  const add = () => {
    if (!comp) return show('Pick a material', 2000)
    const n = Number(qty) || 0
    if (n <= 0) return show('Enter a quantity', 2000)
    rejects.insert({ date: todayStr(), componentId: comp.id, componentName: comp.name, qty: n, reason: reason.trim(), by })
    log('REJECT_MATERIAL', `${comp.name} −${n}${reason ? ' · ' + reason.trim() : ''}`, by)
    show(`Scrapped ${comp.name} −${fmtNum(n)} ✓`)
    setQty(''); setReason('')
  }

  return (
    <Card className="p-5 space-y-3">
      <Toast msg={msg} />
      <FieldLabel className="text-red-600">⚠ Scrap Defective Material</FieldLabel>
      <p className="text-xs text-slate-400 -mt-1">Report a bad raw part — it's deducted from stock.</p>
      {components.list.length === 0 ? (
        <p className="text-sm text-slate-400">No materials yet.</p>
      ) : (
        <>
          <Select value={componentId} onChange={e => setComponentId(e.target.value)}
            options={sorted.map(c => ({ value: c.id, label: c.name }))} />
          <NumberInput placeholder="Quantity scrapped" value={qty} onChange={e => setQty(e.target.value)} />
          <TextInput placeholder="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} />
          <Button variant="danger" className="w-full" onClick={add}>Scrap from Stock</Button>
        </>
      )}
    </Card>
  )
}
