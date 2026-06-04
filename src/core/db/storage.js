/**
 * Storage Adapter
 * ----------------
 * The single low-level gateway to persistent storage. Every read/write in the
 * app goes through an adapter that implements this interface — NOTHING else
 * touches localStorage directly. This is what makes the backend swappable:
 * to move from on-device storage to the cloud (e.g. Firebase) later, you only
 * write a new adapter with the same four methods and register it here.
 */

const APP_PREFIX = 'fa:' // all keys namespaced so this app never collides with others on the same domain

/** localStorage-backed adapter (default, works fully offline, per-device). */
const localStorageAdapter = {
  getRaw(key) {
    try {
      const raw = localStorage.getItem(APP_PREFIX + key)
      return raw == null ? null : JSON.parse(raw)
    } catch {
      return null
    }
  },
  setRaw(key, value) {
    localStorage.setItem(APP_PREFIX + key, JSON.stringify(value))
  },
  remove(key) {
    localStorage.removeItem(APP_PREFIX + key)
  },
  keys() {
    return Object.keys(localStorage)
      .filter(k => k.startsWith(APP_PREFIX))
      .map(k => k.slice(APP_PREFIX.length))
  },
}

let activeAdapter = localStorageAdapter

/** Replace the storage backend at runtime (used by tests or a future cloud sync). */
export function setStorageAdapter(adapter) {
  activeAdapter = adapter
}

/** Public storage API — repositories and migrations use only this. */
export const storage = {
  get: (key) => activeAdapter.getRaw(key),
  set: (key, value) => activeAdapter.setRaw(key, value),
  remove: (key) => activeAdapter.remove(key),
  keys: () => activeAdapter.keys(),
}
