/**
 * Module Registry — the list of factory modules the app knows about.
 * Adding a future module is a one-line change here once it exports a manifest.
 */
import { fittingModule } from './fitting/manifest'

export const modules = [
  fittingModule,
  // { future modules go here }
]

/** Look up a module by id. */
export const getModule = (id) => modules.find(m => m.id === id) || modules[0]
