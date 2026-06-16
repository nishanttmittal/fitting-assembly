/**
 * AppShell — mounts the active module's state Provider, then requires Google
 * sign-in (AuthGate) and routes by the user's role:
 *
 *   • staff (or a dedicated …/?floor link) → only the floor page (Enter Production)
 *   • owner / manager                      → full console (card grid + every page)
 *
 * Google login replaces the old anonymous role-chooser + shared admin password,
 * so Firestore rules can enforce per-email access (no anonymous data access).
 */
import { useState } from 'react'
import { getModule } from '../modules/registry'
import AuthGate from './AuthGate'
import ModuleHome from './ModuleHome'
import NavBar from './NavBar'

/** Slim top bar with the current role and an optional Sign-out button. */
function RoleBar({ label, onSignOut }) {
  return (
    <div className="bg-slate-900 text-slate-300 px-4 py-2 flex items-center justify-between text-xs no-print">
      <span className="font-semibold tracking-wide uppercase">{label}</span>
      {onSignOut && (
        <button onClick={onSignOut} className="flex items-center gap-1 text-slate-400 hover:text-white font-medium">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      )}
    </div>
  )
}

/** The full admin console: card grid + per-page navigation. */
function AdminConsole({ module, label, onSignOut }) {
  const [activeKey, setActiveKey] = useState(null) // null = home grid
  const activePage = module.pages.find(p => p.key === activeKey)
  return (
    <div className="min-h-screen bg-slate-50">
      <RoleBar label={label} onSignOut={onSignOut} />
      {activePage ? (
        <>
          <NavBar title={activePage.title} onHome={() => setActiveKey(null)} />
          <activePage.Component />
        </>
      ) : (
        <ModuleHome module={module} onOpen={setActiveKey} />
      )}
    </div>
  )
}

/** The shop-floor interface: just the floor page. */
function FloorView({ module, onSignOut, operator = '' }) {
  const page = module.pages.find(p => p.key === module.floorPageKey) || module.pages[0]
  return (
    <div className="min-h-screen bg-slate-50">
      <RoleBar label={operator ? `Shop Floor · ${operator}` : 'Shop Floor'} onSignOut={onSignOut} />
      <header className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-5 py-4 no-print">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center text-lg">{module.icon}</div>
          <div>
            <div className="font-bold leading-tight">{module.title}</div>
            <div className="text-white/80 text-xs">{page.title}{operator ? ` · ${operator}` : ''}</div>
          </div>
        </div>
      </header>
      <page.Component floor operator={operator} />
    </div>
  )
}

export default function AppShell({ moduleId }) {
  const module = getModule(moduleId)
  const { Provider } = module

  // A dedicated shop-floor link (…/?floor or ?floor=1) locks the device to the
  // floor interface (no sign-out button), still behind a one-time Google login.
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const floorOnly = params && params.has('floor')
  // Dedicated-phone attribution: ?who=Ramesh tags entries to that worker.
  const who = (params && params.get('who')) || ''

  return (
    <Provider>
      <AuthGate title={module.title} icon={module.icon}>
        {({ role, name, signOut }) => {
          if (floorOnly) return <FloorView module={module} operator={who || name} />
          if (role === 'staff') return <FloorView module={module} operator={who || name} onSignOut={signOut} />
          return <AdminConsole module={module} label={`Admin Console · ${name}`} onSignOut={signOut} />
        }}
      </AuthGate>
    </Provider>
  )
}
