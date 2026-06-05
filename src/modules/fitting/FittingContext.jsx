/**
 * FittingContext — module-wide reactive state: components, products, receipts,
 * production entries and audit logs, plus a logging helper.
 *
 * Two backends provide the SAME context shape:
 *   • LocalFittingProvider — localStorage (offline, single-device)
 *   • FirestoreProvider    — cloud real-time sync (multi-device)
 * `FittingProvider` picks Firestore when configured, else local — so every page
 * works unchanged regardless of backend.
 *
 * Pages derive component stock from (components/receipts/production) via
 * logic/stock.js; the context deliberately stores only raw records.
 */
import { createContext, useContext, useCallback } from 'react'
import { useCollection } from '../../core/hooks/useCollection'
import {
  componentsRepo, productsRepo, receiptsRepo, productionRepo, adjustmentsRepo, rejectsRepo,
  repairsRepo, dispatchRepo, rejectReasonsRepo, logsRepo, lastUsedStore,
} from './data'
import { isFirebaseConfigured } from '../../core/db/firebaseConfig'
import { FirestoreProvider } from './FirestoreProvider'

const Ctx = createContext(null)
export { Ctx as FittingCtx }

/** Backend selector. */
export function FittingProvider({ children }) {
  return isFirebaseConfigured
    ? <FirestoreProvider>{children}</FirestoreProvider>
    : <LocalFittingProvider>{children}</LocalFittingProvider>
}

/** localStorage-backed provider (offline / single-device). */
export function LocalFittingProvider({ children }) {
  const components  = useCollection(componentsRepo)
  const products    = useCollection(productsRepo)
  const receipts    = useCollection(receiptsRepo)
  const production  = useCollection(productionRepo)
  const adjustments = useCollection(adjustmentsRepo)
  const rejects     = useCollection(rejectsRepo)
  const repairs     = useCollection(repairsRepo)
  const dispatch    = useCollection(dispatchRepo)
  const rejectReasons = useCollection(rejectReasonsRepo)
  const logs        = useCollection(logsRepo)

  const log = useCallback((action, detail, by = 'user', ref = '') => {
    logs.insert({ ts: new Date().toISOString(), action, detail, by, ref })
  }, [logs])

  const value = {
    components, products, receipts, production, adjustments, rejects, repairs, dispatch, rejectReasons, logs,
    lastUsed: lastUsedStore,
    log,
    cloud: { connected: false, error: '' }, // local mode
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useFitting() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useFitting must be used inside <FittingProvider>')
  return v
}
