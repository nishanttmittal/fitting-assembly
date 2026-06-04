/**
 * PDF generation + native share (WhatsApp). Builds a real PDF with jsPDF and
 * shares it through the device share sheet (iPhone/Android → WhatsApp). Falls
 * back to download on desktop where file-sharing isn't available.
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fmtDate, fmtNum, todayStr } from '../../../core/utils/format'
import { APP_TITLE } from '../config'

const TEAL = [13, 118, 110]

function header(doc, title, sub) {
  doc.setFontSize(16); doc.setTextColor(...TEAL); doc.setFont(undefined, 'bold')
  doc.text(APP_TITLE, 40, 40)
  doc.setFontSize(13); doc.setTextColor(30, 41, 59)
  doc.text(title, 40, 60)
  doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.setFont(undefined, 'normal')
  doc.text(sub, 40, 76)
}

/**
 * Production report for a date range: per-product totals + a daily detail list.
 */
export function buildProductionPdf(production, from, to) {
  const rows = production
    .filter(p => (!from || p.date >= from) && (!to || p.date <= to))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.productName || '').localeCompare(b.productName || ''))

  const totals = {}
  for (const p of rows) totals[p.productName] = (totals[p.productName] || 0) + (Number(p.qty) || 0)

  const doc = new jsPDF('p', 'pt', 'a4')
  header(doc, 'Production Report',
    `Period: ${from ? fmtDate(from) : 'Beginning'} to ${fmtDate(to || todayStr())} · Generated ${fmtDate(todayStr())}`)

  autoTable(doc, {
    startY: 92,
    head: [['Product', 'Total Assembled']],
    body: Object.entries(totals).map(([name, q]) => [name, fmtNum(q)]),
    foot: [['TOTAL', fmtNum(Object.values(totals).reduce((s, q) => s + q, 0))]],
    headStyles: { fillColor: TEAL },
    footStyles: { fillColor: [204, 251, 241], textColor: 20 },
    styles: { fontSize: 10 },
  })

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 24,
    head: [['Date', 'Product', 'Qty']],
    body: rows.map(p => [fmtDate(p.date), p.productName, fmtNum(p.qty)]),
    headStyles: { fillColor: [71, 85, 105] },
    styles: { fontSize: 9 },
  })
  return doc
}

/** Component stock report (current). `stockList` = values of the stock map. */
export function buildStockPdf(stockList) {
  const doc = new jsPDF('p', 'pt', 'a4')
  header(doc, 'Component Stock Report', `As of ${fmtDate(todayStr())}`)
  autoTable(doc, {
    startY: 92,
    head: [['Component', 'Received', 'Used', 'In Stock', 'Status']],
    body: stockList
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(s => [
        `${s.name} (${s.unit})`,
        fmtNum(s.received), fmtNum(s.used), fmtNum(s.stock),
        s.negative ? 'SHORT' : s.low ? 'Low' : 'OK',
      ]),
    headStyles: { fillColor: TEAL },
    styles: { fontSize: 9 },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 4) {
        if (d.cell.raw === 'SHORT') { d.cell.styles.textColor = [220, 38, 38]; d.cell.styles.fontStyle = 'bold' }
        else if (d.cell.raw === 'Low') { d.cell.styles.textColor = [217, 119, 6] }
      }
    },
  })
  return doc
}

/**
 * Share a jsPDF document: tries the native share sheet (WhatsApp etc. on
 * mobile); falls back to download on desktop.
 */
export async function sharePdf(doc, filename) {
  const blob = doc.output('blob')
  const file = new File([blob], filename, { type: 'application/pdf' })
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
