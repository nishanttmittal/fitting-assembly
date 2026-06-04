/**
 * Export / Share — build a PDF (production report for a date range, or current
 * component-stock report) and share it via the device share sheet → WhatsApp.
 */
import { useMemo, useState } from 'react'
import { Button, Card, FieldLabel, DateInput, useToast, Toast } from '../../../core/ui'
import { todayStr } from '../../../core/utils/format'
import { useFitting } from '../FittingContext'
import { computeStock } from '../logic/stock'
import { buildProductionPdf, buildStockPdf, sharePdf } from '../logic/pdf'

export default function Export() {
  const { components, receipts, production } = useFitting()
  const { msg, show } = useToast()
  const [from, setFrom] = useState(todayStr().slice(0, 8) + '01') // 1st of this month
  const [to, setTo] = useState(todayStr())

  const stockList = useMemo(
    () => Object.values(computeStock(components.list, receipts.list, production.list)),
    [components.list, receipts.list, production.list]
  )

  const result = (r) => show(r === 'shared' ? 'Shared ✓' : r === 'cancelled' ? 'Cancelled' : 'Downloaded ✓')

  const shareProduction = async () => {
    const doc = buildProductionPdf(production.list, from, to)
    result(await sharePdf(doc, `Production_${from}_to_${to}.pdf`))
  }
  const shareStock = async () => {
    const doc = buildStockPdf(stockList)
    result(await sharePdf(doc, `Component_Stock_${todayStr()}.pdf`))
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Toast msg={msg} />

      <Card className="p-5 space-y-4">
        <FieldLabel>Production Report</FieldLabel>
        <div className="grid grid-cols-2 gap-3">
          <div><FieldLabel>From</FieldLabel><DateInput className="mt-1" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><FieldLabel>To</FieldLabel><DateInput className="mt-1" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
        <Button variant="primary" size="lg" className="w-full" onClick={shareProduction}>
          📄 Share Production PDF
        </Button>
        <p className="text-xs text-slate-400 text-center">Per-product totals + day-wise detail for the chosen dates.</p>
      </Card>

      <Card className="p-5 space-y-4">
        <FieldLabel>Component Stock Report</FieldLabel>
        <Button variant="success" size="lg" className="w-full" onClick={shareStock}>
          📦 Share Stock PDF
        </Button>
        <p className="text-xs text-slate-400 text-center">Current received / used / in-stock for every component.</p>
      </Card>
    </div>
  )
}
