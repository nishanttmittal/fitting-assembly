/**
 * AppShell — mounts the active module's state Provider once, then routes to one
 * of TWO interfaces based on a device-remembered role:
 *
 *   • Shop Floor   → only the module's floor page (Enter Production). No password.
 *   • Owner/Admin  → password-gated full console (card grid + every page).
 *
 * The role is stored per device so a dedicated shop-floor phone always opens
 * straight into production entry. A "Switch" control returns to the chooser.
 */
import { useState } from 'react'
import { getModule } from '../modules/registry'
import { PasswordGate } from '../core/ui'
import ModuleHome from './ModuleHome'
import NavBar from './NavBar'
import RoleChooser from './RoleChooser'

const ROLE_KEY = 'fa:role'

/** Slim top bar with the current role and an optional Switch button. */
function RoleBar({ label, onSwitch }) {
  return (
    <div className="bg-slate-900 text-slate-300 px-4 py-2 flex items-center justify-between text-xs no-print">
      <span className="font-semibold tracking-wide uppercase">{label}</span>
      {onSwitch && (
        <button onClick={onSwitch} className="flex items-center gap-1 text-slate-400 hover:text-white font-medium">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Switch
        </button>
      )}
    </div>
  )
}

/** The full admin console: card grid + per-page navigation. */
function AdminConsole({ module, onSwitch }) {
  const [activeKey, setActiveKey] = useState(null) // null = home grid
  const activePage = module.pages.find(p => p.key === activeKey)
  return (
    <div className="min-h-screen bg-slate-50">
      <RoleBar label="Admin Console" onSwitch={onSwitch} />
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

/** The shop-floor interface: just the floor page, no password. */
function FloorView({ module, onSwitch }) {
  const page = module.pages.find(p => p.key === module.floorPageKey) || module.pages[0]
  return (
    <div className="min-h-screen bg-slate-50">
      <RoleBar label="Shop Floor" onSwitch={onSwitch} />
      <header className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-5 py-4 no-print">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center text-lg">{module.icon}</div>
          <div>
            <div className="font-bold leading-tight">{module.title}</div>
            <div className="text-white/80 text-xs">{page.title}</div>
          </div>
        </div>
      </header>
      <page.Component floor />
    </div>
  )
}

export default function AppShell({ moduleId }) {
  const module = getModule(moduleId)
  const { Provider } = module
  const [role, setRole] = useState(() => localStorage.getItem(ROLE_KEY))

  const pick = (r) => { localStorage.setItem(ROLE_KEY, r); setRole(r) }
  const reset = () => { localStorage.removeItem(ROLE_KEY); setRole(null) }

  // A dedicated shop-floor link (…/?floor or ?floor=1) locks the device to the
  // floor interface — no chooser, no admin, no Switch. The plain link keeps the
  // chooser (Shop Floor + Owner/Admin) for you.
  const floorOnly = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('floor')

  return (
    <Provider>
      {floorOnly ? (
        <FloorView module={module} />
      ) : (
        <>
          {!role && <RoleChooser title={module.title} icon={module.icon} onPick={pick} />}
          {role === 'floor' && <FloorView module={module} onSwitch={reset} />}
          {role === 'admin' && (
            <PasswordGate password={module.adminPassword} title="Admin Console — Login">
              <AdminConsole module={module} onSwitch={reset} />
            </PasswordGate>
          )}
        </>
      )}
    </Provider>
  )
}
