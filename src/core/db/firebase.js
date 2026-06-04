/**
 * Firebase service — initialises the app, Firestore (offline-capable) and Auth.
 * Low-level cloud gateway; the FirestoreProvider builds on it. Safe to import
 * even when not configured (guards inside).
 *
 * Data layout in Firestore (under one app namespace so the project can host
 * other apps too — this project also hosts "platingjobwork"):
 *   apps/fitting/components/{id}    ← one doc per component (master)
 *   apps/fitting/products/{id}      ← one doc per final product (+ recipe)
 *   apps/fitting/receipts/{id}      ← one doc per component stock receipt
 *   apps/fitting/production/{id}    ← one doc per production entry
 *   apps/fitting/logs/{id}          ← one doc per audit log line
 */
import { initializeApp, getApp } from 'firebase/app'
import {
  initializeFirestore, collection, doc,
  persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore'
import {
  getAuth, signInAnonymously, onAuthStateChanged,
  GoogleAuthProvider, signInWithPopup,
} from 'firebase/auth'
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig'

const APP_NS = 'fitting'

let app = null
let db = null
let auth = null

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig)
  // Persistent on-device cache (IndexedDB) so the app works OFFLINE: the floor
  // can keep saving production with no internet; entries queue and auto-sync on
  // reconnect. Multi-tab safe. Auto long-polling for restrictive networks.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    experimentalAutoDetectLongPolling: true,
  })
  auth = getAuth(app)
}

export { app, db, auth, isFirebaseConfigured, APP_NS }

/** A per-document collection under the app namespace. */
const coll = (name) => collection(db, 'apps', APP_NS, name)
const cdoc = (name, id) => doc(db, 'apps', APP_NS, name, id)

/** Path helpers for the app's Firestore documents/collections. */
export const paths = {
  components: () => coll('components'),
  component: (id) => cdoc('components', id),
  products: () => coll('products'),
  product: (id) => cdoc('products', id),
  receipts: () => coll('receipts'),
  receipt: (id) => cdoc('receipts', id),
  production: () => coll('production'),
  productionDoc: (id) => cdoc('production', id),
  adjustments: () => coll('adjustments'),
  adjustmentDoc: (id) => cdoc('adjustments', id),
  rejects: () => coll('rejects'),
  rejectDoc: (id) => cdoc('rejects', id),
  repairs: () => coll('repairs'),
  repairDoc: (id) => cdoc('repairs', id),
  dispatch: () => coll('dispatch'),
  dispatchDoc: (id) => cdoc('dispatch', id),
  rejectReasons: () => coll('reject_reasons'),
  rejectReasonDoc: (id) => cdoc('reject_reasons', id),
  logs: () => coll('logs'),
  logDoc: (id) => cdoc('logs', id),
}

/** Ensure there is a signed-in user (anonymous by default). Resolves to uid. */
export function ensureSignedIn() {
  return new Promise((resolve, reject) => {
    if (!auth) return reject(new Error('Firebase not configured'))
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) { unsub(); resolve(user.uid) }
    })
    signInAnonymously(auth).catch(reject)
  })
}

/**
 * Verify the admin's identity with Google sign-in — on an ISOLATED secondary
 * Firebase instance, so the primary app's anonymous session (which powers all
 * data sync) is never disturbed. Returns the verified lowercase email then
 * signs that secondary session out. Identity check only — does not change who
 * reads/writes the database.
 */
export async function verifyAdminGoogle() {
  if (!isFirebaseConfigured) throw new Error('Cloud not configured')
  const NAME = 'adminVerify'
  let secondary
  try { secondary = getApp(NAME) } catch { secondary = initializeApp(firebaseConfig, NAME) }
  const aAuth = getAuth(secondary)
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const cred = await signInWithPopup(aAuth, provider)
  const email = (cred.user.email || '').toLowerCase()
  await aAuth.signOut().catch(() => {})
  return email
}
