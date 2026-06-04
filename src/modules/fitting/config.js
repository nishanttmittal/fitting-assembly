/**
 * Fitting Assembly module — configuration & constants.
 */

export const APP_TITLE = 'Fitting'

/** Admin password guarding setup (recipes/components) & destructive actions.
 *  Permanent fallback so admin access can never be locked out. */
export const ADMIN_PASSWORD = '6133923_N'

/** The only Google account allowed to unlock Admin via Google sign-in. */
export const ADMIN_EMAIL = 'nspenterprises24@gmail.com'

/** Quick-add chips on the quantity stepper (fast floor entry). */
export const QUICK_QTYS = [5, 10, 25, 50, 100, 200]

/**
 * Allowed deviation (%) between a lot's average weight and the admin standard
 * before a red flag is shown when receiving by-weight material. Within this the
 * lot is treated as normal; beyond it, the entry is flagged (but still saved &
 * calculated). Change this single value to loosen/tighten the check.
 */
export const AVG_WEIGHT_TOLERANCE_PCT = 1

/**
 * The final products produced by the fitting department (UNICO chair
 * mechanisms & base parts). More can be added in-app (admin → Products).
 * Names lead with the catalogue code so they sort and search nicely.
 */
export const DEFAULT_PRODUCTS = [
  'UTM-1 Tilting Mechanism',
  'UTM-2 Tilting Mechanism with Channel',
  'UTM-3 Small Tilting Mechanism',
  'UPM-1 Lever Plate',
  'UPM-2 Lever Plate with Channel',
  'UPM-3 Push Back Mechanism',
  'UPM-4 Push Back Mechanism with Dibbi',
  'USM-1 Sleek Push Back Mechanism',
  'USM-2 Sleek Push Back Mechanism with Dibbi',
  'USSM-1 Smart Synchro Mechanism',
  'USSM-2 Big Synchro Mechanism',
  'UTRM-1 Torsion Mechanism',
  'USP-1 6" Square Plate',
  'USP-2 4" Round Plate',
  'USP-3 Megna Shell Fitting',
  'UCAP-101 4" Foot Rest',
  'UCAP-102 6" Foot Rest',
  'UCAP-103A Big Cross Bar',
  'UCAP-103B Small Cross Bar',
  'UCAP-106 Foot Ring',
]

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
