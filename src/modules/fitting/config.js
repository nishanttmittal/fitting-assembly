/**
 * Fitting Assembly module — configuration & constants.
 */

export const APP_TITLE = 'Fitting Assembly'

/** Admin password guarding setup (recipes/components) & destructive actions.
 *  Permanent fallback so admin access can never be locked out. */
export const ADMIN_PASSWORD = '6133923_N'

/** The only Google account allowed to unlock Admin via Google sign-in. */
export const ADMIN_EMAIL = 'nspenterprises24@gmail.com'

/** Quick-add chips on the quantity stepper (fast floor entry). */
export const QUICK_QTYS = [5, 10, 25, 50, 100, 200]

/** A fresh install starts with 10 placeholder products to rename in Setup. */
export const DEFAULT_PRODUCTS = Array.from({ length: 10 }, (_, i) => `Product ${i + 1}`)

/** No components by default — added by admin in Setup. */
export const DEFAULT_COMPONENTS = []

/** Storage keys owned by this module. */
export const KEYS = {
  components: 'components',
  products:   'products',
  receipts:   'receipts',
  production: 'production',
  logs:       'logs',
  lastUsed:   'last_used',
}
