/**
 * Inbound auto-feed — the channel other apps use to add component stock here.
 * ──────────────────────────────────────────────────────────────────────────
 * Any sibling app in the "unico-operations" Firebase project can push a
 * "manufactured" stock receipt into this app simply by writing one document to
 *     apps/fittingassembly/receipts/{id}
 * Our receipts listener then folds it into component stock automatically — no
 * code change needed here. Matching is by component NAME (case-insensitive),
 * so the feeding app does not need to know this app's internal ids.
 *
 * This module is the reference implementation (and is used by feed-example.mjs).
 * Future apps can import it, or copy the standalone snippet from INTEGRATION.md.
 *
 * Idempotency: the document id is derived from (sourceApp + ref). Re-sending the
 * same (sourceApp, ref) UPDATES that one receipt instead of adding a duplicate,
 * so a feeding app can safely retry or re-sync.
 */
import { setDoc, doc } from 'firebase/firestore'
import { db, APP_NS } from '../core/db/firebase'

const safe = (s) => String(s ?? '').trim().replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 64) || 'x'

/**
 * Feed a manufactured-component stock receipt into Fitting Assembly.
 * @param {object} p
 * @param {string}  p.componentName  component name as known here (required for matching)
 * @param {number}  p.qty            quantity produced/delivered (required)
 * @param {string}  p.sourceApp      the feeding app's id, e.g. 'coil-slitter' (required)
 * @param {string} [p.ref]           the feeding app's voucher/challan id (recommended — keeps it idempotent)
 * @param {string} [p.date]          yyyy-mm-dd (defaults to today)
 * @param {string} [p.componentId]   optional internal id if the feeder knows it
 * @param {string} [p.note]          optional note
 * @returns {Promise<string>} the receipt document id written
 */
export async function feedComponentStock({ componentName, qty, sourceApp, ref = '', date, componentId = '', note = '' }) {
  if (!componentName) throw new Error('feedComponentStock: componentName is required')
  if (!sourceApp) throw new Error('feedComponentStock: sourceApp is required')
  const id = `feed_${safe(sourceApp)}_${safe(ref || `${componentName}_${date || ''}`)}`
  const row = {
    id,
    date: date || new Date().toISOString().slice(0, 10),
    componentId,
    componentName,
    qty: Number(qty) || 0,
    source: 'manufactured',
    sourceApp,
    ref,
    note,
    createdAt: new Date().toISOString(),
  }
  await setDoc(doc(db, 'apps', APP_NS, 'receipts', id), row, { merge: true })
  return id
}
