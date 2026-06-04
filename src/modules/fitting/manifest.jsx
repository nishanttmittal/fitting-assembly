/**
 * Fitting Assembly — module manifest. The contract the app shell mounts
 * generically. Pages are listed in floor-friendly order (Enter Production first).
 */
import { FittingProvider, useFitting } from './FittingContext'
import { computeStock, shortages } from './logic/stock'
import { todayStr } from '../../core/utils/format'
import { ADMIN_PASSWORD } from './config'
import NewProduction from './pages/NewProduction'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Setup from './pages/Setup'
import Export from './pages/Export'
import Admin from './pages/Admin'

/** Small stats strip on the module home screen. */
function HomeStats() {
  const { components, receipts, production, adjustments } = useFitting()
  const today = todayStr()
  const madeToday = production.list
    .filter(p => p.date === today)
    .reduce((s, p) => s + (Number(p.qty) || 0), 0)
  const stockMap = computeStock(components.list, receipts.list, production.list, adjustments.list)
  const short = shortages(stockMap).length

  const stat = (n, l, tone = '') => (
    <div className="bg-white/10 rounded-xl px-4 py-2.5 flex-1 text-center">
      <div className={`text-2xl font-bold ${tone}`}>{n}</div>
      <div className="text-xs text-slate-400 mt-0.5">{l}</div>
    </div>
  )
  return (
    <div className="mt-4 flex gap-3">
      {stat(madeToday, 'Made Today')}
      {stat(components.list.length, 'Components')}
      {stat(short, 'Short', short > 0 ? 'text-red-300' : '')}
    </div>
  )
}

export const fittingModule = {
  id: 'fitting',
  title: 'Fitting',
  icon: '🛠️',
  Provider: FittingProvider,
  HomeStats,
  // Role split: the floor interface shows only pages flagged `floor: true`; the
  // admin console (password below) shows everything.
  adminPassword: ADMIN_PASSWORD,
  floorPageKey: 'newProduction',
  pages: [
    { key: 'newProduction', title: 'Enter Production',     desc: 'Log final products assembled today',  icon: '➕', color: 'from-emerald-600 to-emerald-700', floor: true, Component: NewProduction },
    { key: 'dashboard',     title: 'Dashboard',            desc: 'Stock, can-build & shortage alerts',  icon: '📊', color: 'from-blue-600 to-blue-700',       Component: Dashboard },
    { key: 'history',       title: 'History',              desc: 'View, edit or delete past entries',   icon: '🗂️', color: 'from-amber-500 to-amber-600',     Component: History },
    { key: 'setup',         title: 'Components & Recipes', desc: 'Set up parts, products & recipes',     icon: '🧩', color: 'from-violet-600 to-violet-700',   Component: Setup },
    { key: 'export',        title: 'Export / Share',       desc: 'Share PDF report on WhatsApp',         icon: '📄', color: 'from-rose-500 to-rose-600',       Component: Export },
    { key: 'admin',         title: 'Admin',                desc: 'Receive stock, backup, reset',         icon: '⚙️', color: 'from-slate-600 to-slate-700',     Component: Admin },
  ],
}
