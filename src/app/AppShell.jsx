/**
 * AppShell — mounts the active module, wraps it in the module's state Provider,
 * and handles navigation between the module home grid and its pages. Generic:
 * it drives everything from the module manifest, so any registered module works.
 */
import { useState } from 'react'
import { getModule } from '../modules/registry'
import ModuleHome from './ModuleHome'
import NavBar from './NavBar'

export default function AppShell({ moduleId }) {
  const module = getModule(moduleId)
  const { Provider } = module
  const [activeKey, setActiveKey] = useState(null) // null = home grid

  const activePage = module.pages.find(p => p.key === activeKey)

  return (
    <Provider>
      {activePage ? (
        <div className="min-h-screen bg-slate-50">
          <NavBar title={activePage.title} onHome={() => setActiveKey(null)} />
          <activePage.Component />
        </div>
      ) : (
        <ModuleHome module={module} onOpen={setActiveKey} />
      )}
    </Provider>
  )
}
