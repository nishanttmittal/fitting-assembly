/**
 * Firestore-backed module state — real-time, multi-device, offline-capable.
 *
 * Exposes the SAME value shape as the local provider (components/products/
 * receipts/production/logs each with .list/.insert/.update/.remove/…, plus
 * log()) so every page works unchanged. Each collection is one Firestore
 * collection of per-document records → concurrent edits on different devices
 * never clobber each other. onSnapshot pushes live updates from any device.
 *
 * Unlike a challan-numbering app, nothing here needs a server-issued number,
 * so creating production entries works fully OFFLINE (queued, auto-synced).
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { onSnapshot, setDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore'
import { db, paths, ensureSignedIn } from '../../core/db/firebase'
import { makeNormalizer } from '../../core/schema/field'
import { makeId } from '../../core/db/repository'
import { componentSchema, productSchema, receiptSchema, productionSchema, adjustmentSchema, rejectSchema, repairSchema, dispatchSchema, rejectReasonSchema } from './schema'
import { DEFAULT_PRODUCTS, DEFAULT_COMPONENTS, DEFAULT_REJECT_REASONS } from './config'
import { lastUsedStore } from './data'
import { FittingCtx } from './FittingContext'

/** Build a live collection binding over a Firestore collection path. */
function useCloudCollection(collPath, docPath, normalize) {
  const [list, setList] = useState([])
  useEffect(() => {
    const unsub = onSnapshot(collPath(), (snap) => {
      setList(snap.docs.map(d => normalize({ id: d.id, ...d.data() })))
    })
    return unsub
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const api = {
    list,
    insert: (rec) => {
      const id = rec.id || makeId('r')
      const row = { createdAt: new Date().toISOString(), ...rec, id }
      setDoc(docPath(id), row)
      return row
    },
    update: (id, patch) => setDoc(docPath(id), patch, { merge: true }),
    remove: (id) => deleteDoc(docPath(id)),
    removeWhere: (pred) => {
      const hit = list.filter(pred)
      const batch = writeBatch(db)
      hit.forEach(r => batch.delete(docPath(r.id)))
      batch.commit()
      return hit.length
    },
    replaceAll: async (rows) => {
      const existing = await getDocs(collPath())
      const b1 = writeBatch(db); existing.forEach(d => b1.delete(d.ref)); await b1.commit()
      const b2 = writeBatch(db)
      ;(rows || []).forEach(r => { const id = r.id || makeId('r'); b2.set(docPath(id), { ...r, id }) })
      await b2.commit()
    },
    reset: async () => {
      const existing = await getDocs(collPath())
      const b = writeBatch(db); existing.forEach(d => b.delete(d.ref)); await b.commit()
    },
  }
  return api
}

const normComponent  = makeNormalizer(componentSchema)
const normProduct    = makeNormalizer(productSchema)
const normReceipt    = makeNormalizer(receiptSchema)
const normProduction = makeNormalizer(productionSchema)
const normAdjustment = makeNormalizer(adjustmentSchema)
const normReject     = makeNormalizer(rejectSchema)
const normRepair     = makeNormalizer(repairSchema)
const normDispatch   = makeNormalizer(dispatchSchema)
const normReason     = makeNormalizer(rejectReasonSchema)

export function FirestoreProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [error, setError] = useState('')

  const components = useCloudCollection(paths.components, paths.component, normComponent)
  const products   = useCloudCollection(paths.products, paths.product, normProduct)
  const receipts   = useCloudCollection(paths.receipts, paths.receipt, normReceipt)
  const production = useCloudCollection(paths.production, paths.productionDoc, normProduction)
  const adjustments = useCloudCollection(paths.adjustments, paths.adjustmentDoc, normAdjustment)
  const rejects    = useCloudCollection(paths.rejects, paths.rejectDoc, normReject)
  const repairs    = useCloudCollection(paths.repairs, paths.repairDoc, normRepair)
  const dispatch   = useCloudCollection(paths.dispatch, paths.dispatchDoc, normDispatch)
  const rejectReasons = useCloudCollection(paths.rejectReasons, paths.rejectReasonDoc, normReason)
  const logs       = useCloudCollection(paths.logs, paths.logDoc, (r) => r)

  // Sign in (anonymous), then the collection listeners above start flowing.
  useEffect(() => {
    let done = false
    const timer = setTimeout(() => { if (!done) setTimedOut(true) }, 12000)
    // One extra listener just to know when the first cloud read lands.
    const unsub = onSnapshot(paths.products(),
      () => { done = true; clearTimeout(timer); setReady(true) },
      (e) => { done = true; clearTimeout(timer); setError(e.message); setReady(true) })
    ensureSignedIn().catch((e) => { done = true; clearTimeout(timer); setError(e.message); setTimedOut(true) })
    return () => { clearTimeout(timer); unsub() }
  }, [])

  const log = useCallback((action, detail, by = 'user') => {
    const id = makeId('log')
    setDoc(paths.logDoc(id), { id, ts: new Date().toISOString(), action, detail, by })
  }, [])

  // First-run seeding: if the cloud has no products yet, create the 10
  // placeholders (fixed ids → idempotent, safe even if two devices seed at
  // once). The admin renames them and sets recipes in Setup.
  const seededRef = useRef(false)
  useEffect(() => {
    if (!ready || seededRef.current) return
    if (products.list.length === 0) {
      seededRef.current = true
      DEFAULT_PRODUCTS.forEach((name, i) => {
        const id = `seed_p${i + 1}`
        setDoc(paths.product(id), {
          id, name, recipe: [],
          photo: '', targetDay: 0, targetMonth: 0, order: i, createdAt: new Date().toISOString(),
        })
      })
    }
    // Seed raw materials independently (idempotent ids).
    if (components.list.length === 0) {
      DEFAULT_COMPONENTS.forEach((c, i) => {
        const id = `seed_c${i + 1}`
        setDoc(paths.component(id), { id, order: i, createdAt: new Date().toISOString(), ...c })
      })
    }
    // Seed reject reasons (idempotent).
    if (rejectReasons.list.length === 0) {
      DEFAULT_REJECT_REASONS.forEach((name, i) => {
        const id = `seed_rr${i + 1}`
        setDoc(paths.rejectReasonDoc(id), { id, name, order: i })
      })
    }
  }, [ready, products.list.length, components.list.length, rejectReasons.list.length])

  if (!ready && timedOut) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4 p-6 text-center">
        <div className="text-4xl">📡</div>
        <div className="text-base font-bold">Can't reach the cloud</div>
        <div className="text-sm text-slate-300 max-w-xs">
          Check your internet connection and try again. If this keeps happening,
          the app's web address may need to be authorised in Firebase.
        </div>
        <button onClick={() => window.location.reload()}
          className="mt-2 bg-white text-slate-900 rounded-xl px-6 py-3 font-bold text-sm">Retry</button>
      </div>
    )
  }
  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-3">
        <div className="text-2xl">☁️</div>
        <div className="text-sm text-slate-300">Connecting to cloud…</div>
      </div>
    )
  }

  const value = {
    components, products, receipts, production, adjustments, rejects, repairs, dispatch, rejectReasons, logs,
    lastUsed: lastUsedStore,
    log,
    cloud: { connected: !error, error },
  }
  return <FittingCtx.Provider value={value}>{children}</FittingCtx.Provider>
}
