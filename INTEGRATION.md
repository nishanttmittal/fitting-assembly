# Fitting — Auto-Feed Integration

How another app (now or in the future) automatically adds **component stock**
into Fitting. This is the "manufactured in-house" supply channel: when
one of your other apps produces a part that becomes a component here, it pushes
the quantity into this app and the stock updates live — no manual entry.

All your apps share **one Firebase project: `unico-operations`**, so this needs
no servers and no extra accounts.

---

## The contract (one document per delivery)

A feeding app writes ONE document into this Firestore collection:

```
apps/fitting/receipts/{id}
```

Document fields:

| field           | type   | required | meaning                                                |
|-----------------|--------|----------|--------------------------------------------------------|
| `componentName` | string | ✅       | Component name **exactly as named in Fitting** (matched case-insensitively). |
| `qty`           | number | ✅       | Quantity delivered into stock.                          |
| `source`        | string | ✅       | Always `"manufactured"` for an in-house feed.           |
| `sourceApp`     | string | ✅       | The feeding app's id, e.g. `"coil-slitter"`.            |
| `ref`           | string | recommended | The feeder's own voucher/challan/job id.            |
| `date`          | string | ✅       | `yyyy-mm-dd`.                                            |
| `componentId`   | string | optional | Internal id if known (usually leave blank — name match is enough). |
| `note`          | string | optional | Free text.                                              |
| `createdAt`     | string | ✅       | ISO timestamp.                                           |

**Matching:** Fitting links the receipt to a component by
`componentName` (case-insensitive). If no component with that name exists yet,
the stock still shows up under that name on the Dashboard so the admin notices
and can create/rename it.

**Idempotency:** use a **deterministic document id** = `feed_<sourceApp>_<ref>`.
Re-writing the same id updates that one receipt instead of creating a duplicate,
so retries and re-syncs are safe. (The helper below does this for you.)

---

## Auth

Day-to-day reads/writes require any signed-in user. Sign in anonymously (already
enabled on the project) before writing:

```js
import { getAuth, signInAnonymously } from 'firebase/auth'
await signInAnonymously(getAuth())
```

Firestore security rules already allow signed-in writes under
`apps/fitting/**` (see `firestore.rules`).

---

## Drop-in helper (copy into the feeding app)

```js
import { initializeApp } from 'firebase/app'
import { getFirestore, setDoc, doc } from 'firebase/firestore'
import { getAuth, signInAnonymously } from 'firebase/auth'

const firebaseConfig = {
  apiKey:            'AIzaSyCK0M-EfmOp9nh1-ZJcrBqT7c4plNxL2FM',
  authDomain:        'unico-operations.firebaseapp.com',
  projectId:         'unico-operations',
  storageBucket:     'unico-operations.firebasestorage.app',
  messagingSenderId: '367786260524',
  appId:             '1:367786260524:web:ae49d5da0ef1a71a9e3989',
}
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const safe = s => String(s ?? '').trim().replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 64) || 'x'

/** Push manufactured-component stock into Fitting. */
export async function feedFittingAssembly({ componentName, qty, sourceApp, ref = '', date, note = '' }) {
  await signInAnonymously(getAuth())
  const id = `feed_${safe(sourceApp)}_${safe(ref || `${componentName}_${date || ''}`)}`
  await setDoc(doc(db, 'apps', 'fitting', 'receipts', id), {
    id,
    date: date || new Date().toISOString().slice(0, 10),
    componentName, qty: Number(qty) || 0,
    source: 'manufactured', sourceApp, ref, note,
    componentId: '', createdAt: new Date().toISOString(),
  }, { merge: true })
  return id
}
```

Usage from a future app (e.g. the coil slitter just made 500 brackets):

```js
await feedFittingAssembly({
  componentName: 'Bracket 50mm',
  qty: 500,
  sourceApp: 'coil-slitter',
  ref: 'CS-2026-0042',          // its own job/challan number
  date: '2026-06-04',
})
```

That's it — the 500 appear in Fitting stock instantly, tagged
**🏭 Manufactured · via coil-slitter**.

---

## Inside this repo

`src/integration/feed.js` exports `feedComponentStock(...)` — the same logic,
reusing this app's Firebase instance. `feed-example.mjs` is a runnable demo.

## Reverse direction (future)

To let the **dashboard** or other apps READ Fitting data (production,
stock), they listen to `apps/fitting/production` and
`apps/fitting/receipts` and compute with the same rule:
`stock = Σ receipts − Σ production.consumed`.
