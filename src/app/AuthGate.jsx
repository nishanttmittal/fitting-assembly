/**
 * AuthGate — Google sign-in for the Fitting app. Roles resolved by email:
 *   • owner   : bootstrap OWNER_EMAILS or a users-doc role 'owner' (active)
 *   • manager : a users-doc role 'manager' (active) — full console
 *   • staff   : a users-doc role 'staff' (active) — shop-floor entry only
 * The Firestore provider signs the device in anonymously for baseline sync;
 * here we require a Google account and resolve the role. Children render only
 * with a valid role; anonymous internet users get "No access".
 */
import { useEffect, useState } from 'react'
import { signInWithGoogle, signOutUser, watchAuth } from '../core/db/firebase'
import { useFitting } from '../modules/fitting/FittingContext'
import { OWNER_EMAILS } from '../modules/fitting/config'

/** 'owner' | 'manager' | 'staff' | null for an email against the users list. */
export function resolveRole(email, users) {
  if (!email) return null
  const e = email.toLowerCase()
  if (OWNER_EMAILS.map(x => x.toLowerCase()).includes(e)) return 'owner'
  const u = (users || []).find(u => (u.email || '').toLowerCase() === e && u.active !== false)
  if (!u) return null
  if (u.role === 'owner') return 'owner'
  if (u.role === 'manager') return 'manager'
  return 'staff'
}

function Screen({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 text-white text-center"
      style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}>{children}</div>
  )
}

export default function AuthGate({ title = 'Fitting', icon = '🔩', children }) {
  const { users } = useFitting()
  const [user, setUser] = useState(undefined) // undefined = loading
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => watchAuth(setUser), [])

  const email = user && !user.isAnonymous ? (user.email || '') : ''
  const role = resolveRole(email, users.list)
  const name = role
    ? (OWNER_EMAILS.map(x => x.toLowerCase()).includes(email.toLowerCase())
      ? 'Owner'
      : ((users.list.find(u => (u.email || '').toLowerCase() === email.toLowerCase()) || {}).name || email))
    : ''

  const doSignIn = async () => {
    setBusy(true); setErr('')
    try { await signInWithGoogle() } catch (e) { setErr(e?.message || 'Sign-in failed') } finally { setBusy(false) }
  }
  const doSignOut = () => signOutUser()

  if (user === undefined) {
    return <Screen><div className="text-2xl">🔐</div><div className="text-sm text-slate-300 mt-2">Checking sign-in…</div></Screen>
  }
  if (email && role) return children({ role, email, name, signOut: doSignOut })
  if (email && !role) {
    return (
      <Screen>
        <div className="text-4xl mb-3">🚫</div>
        <h1 className="text-xl font-bold">No access</h1>
        <p className="text-slate-400 text-sm mt-2 max-w-xs">{email} is not authorised. Ask the admin to add you in Admin → Users &amp; Access.</p>
        <button onClick={doSignOut} className="mt-6 bg-white/15 rounded-xl px-5 py-2.5 font-bold text-sm">Use a different account</button>
      </Screen>
    )
  }
  return (
    <Screen>
      <div className="text-5xl mb-3">{icon}</div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-slate-400 text-sm mt-1 mb-8">Sign in to continue</p>
      <button onClick={doSignIn} disabled={busy}
        className="w-full max-w-xs bg-white text-slate-800 rounded-2xl px-6 py-4 font-bold shadow-xl active:scale-95 transition-transform disabled:opacity-60 flex items-center justify-center gap-3">
        <span className="text-lg">🟦</span>{busy ? 'Opening…' : 'Sign in with Google'}
      </button>
      {err && <p className="text-red-300 text-xs mt-4 max-w-xs">{err}</p>}
    </Screen>
  )
}
