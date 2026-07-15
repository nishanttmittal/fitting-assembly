/**
 * Fitting Assembly module — configuration & constants.
 */

export const APP_TITLE = 'Fitting'


/** The only Google account allowed to unlock Admin via Google sign-in. */
export const ADMIN_EMAIL = 'nspenterprises24@gmail.com'

/** Bootstrap owner emails — always allowed (Google login), even before any
 *  users-doc exists. Additional managers/staff are granted by adding a
 *  users-doc (apps/fitting/users/<email>) with role owner|manager|staff. */
export const OWNER_EMAILS = ['nspenterprises24@gmail.com']

/** Quick-add chips on the quantity stepper (fast floor entry). */
export const QUICK_QTYS = [5, 10, 25, 50, 100, 200]

/**
 * Allowed deviation (%) between a lot's average weight and the admin standard
 * before a red flag is shown when receiving by-weight material. Within this the
 * lot is treated as normal; beyond it, the entry is flagged (but still saved &
 * calculated). Change this single value to loosen/tighten the check.
 */
export const AVG_WEIGHT_TOLERANCE_PCT = 1

/** Default reject reasons (admin can add/remove in the console). */
export const DEFAULT_REJECT_REASONS = [
  'Welding issue',
  'Fitting issue',
  'Hole mismatch',
  'Powder defect',
  'Missing hardware',
]

/** Shop floor may back-date entries up to this many days (admin: any date). */
export const FLOOR_BACKDATE_DAYS = 2

/**
 * The final products produced by the fitting department (UNICO chair
 * mechanisms & base parts). The code (first token of the name, e.g. UTM-1) is
 * also used to find its photo at `${BASE_URL}products/<code>.jpg`. More can be
 * added in-app (admin → Products).
 */
export const DEFAULT_PRODUCTS = [
  'UTM-1 Tilting Mechanism',
  'UTM-1H Tilting Mechanism (Heavy)',
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

/**
 * Raw-material master list, grouped by category. Pieces unless measureBy:
 * 'weight' (then avgWeight is per piece in weightUnit). Stock/reorder/cost are
 * filled in-app. Add more in admin → Components.
 */
export const DEFAULT_COMPONENTS = [
  // Nylon Bush (pieces) — supplier DK Plastic / Dheeraj
  { name: 'Nylon Bush 3 no. (TM/Synchro)', category: 'Nylon Bush', supplierName: 'DK Plastic / Dheeraj' },
  { name: 'Nylon Bush 1 no. (PM)',         category: 'Nylon Bush', supplierName: 'DK Plastic / Dheeraj' },
  { name: 'Nylon Bush Sq (Synchro)',       category: 'Nylon Bush', supplierName: 'DK Plastic / Dheeraj' },
  { name: 'Nylon Bush Small (Synchro)',    category: 'Nylon Bush', supplierName: 'DK Plastic / Dheeraj' },
  // Box (packing, pieces) — packing:true so rejects don't consume a box
  { name: 'Box Pushback',      category: 'Box', packing: true },
  { name: 'Box Tilting',       category: 'Box', packing: true },
  { name: 'Box Synchro Big',   category: 'Box', packing: true },
  { name: 'Box Synchro Smart', category: 'Box', packing: true },
  { name: 'Box Torsion',       category: 'Box', packing: true },
  { name: 'Box 4"',            category: 'Box', packing: true },
  { name: 'Box 6"',            category: 'Box', packing: true },
  // Rivet (by weight, grams)
  { name: 'Rivet 92mm',  category: 'Rivet', measureBy: 'weight', avgWeight: 36.4, weightUnit: 'g' },
  { name: 'Rivet 95mm',  category: 'Rivet', measureBy: 'weight', avgWeight: 37.8, weightUnit: 'g' },
  { name: 'Rivet 105mm', category: 'Rivet', measureBy: 'weight', avgWeight: 42,   weightUnit: 'g' },
  // Spring (pieces)
  { name: 'Spring Tilting',       category: 'Spring' },
  { name: 'Spring Pushback',      category: 'Spring' },
  { name: 'Spring Big Synchro',   category: 'Spring' },
  { name: 'Spring Smart Synchro', category: 'Spring' },
  // Carriage Bolt (by weight, grams)
  { name: '4" Bolt (Synchro/PM)', category: 'Carriage Bolt', measureBy: 'weight', avgWeight: 53.8, weightUnit: 'g' },
  { name: '4.25" Bolt (TM)',      category: 'Carriage Bolt', measureBy: 'weight', avgWeight: 59.6, weightUnit: 'g' },
]

/** Storage keys owned by this module. */
export const KEYS = {
  components:  'components',
  products:    'products',
  receipts:    'receipts',
  production:  'production',
  adjustments: 'adjustments',
  rejects:       'rejects',
  repairs:       'repairs',
  dispatch:      'dispatch',
  rejectReasons: 'reject_reasons',
  logs:          'logs',
  lastUsed:    'last_used',
}
