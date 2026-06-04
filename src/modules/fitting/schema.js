/**
 * Fitting Assembly — record schemas.
 *
 * Four record types, each a list of field() definitions so forms, defaults and
 * normalization come from one source of truth. To add a field later, add one
 * field() entry — old records keep working because the normalizer fills the
 * new field's default on read.
 *
 *   COMPONENT   a raw part used to build products      (master data)
 *   PRODUCT     a final assembled product + its recipe (master data)
 *   RECEIPT     stock of a component coming IN          (movement: +stock)
 *   PRODUCTION  a final product assembled              (movement: −stock)
 *
 * Component stock is never stored as a mutable number — it is always computed
 * as (sum of receipts) − (sum of production consumption). This is concurrency-
 * safe across devices and lets any historical point be recomputed exactly.
 */
import { field } from '../../core/schema/field'
import { todayStr } from '../../core/utils/format'

/**
 * A raw component / part.
 * `source` records where this component normally comes IN from:
 *   purchased     — bought from outside (entered manually)
 *   manufactured  — made in your factory (can be auto-fed by another app)
 *   both          — sometimes bought, sometimes made
 * `sourceApp` is an optional label for the future app that feeds it in-house
 * (e.g. "coil-slitter") — purely informational here.
 */
export const componentSchema = [
  field({ name: 'name',      label: 'Component', type: 'text',   default: '', required: true }),
  field({ name: 'category',  label: 'Category',  type: 'text',   default: '' }),
  field({ name: 'unit',      label: 'Unit',      type: 'text',   default: 'pcs' }),
  field({ name: 'lowAt',     label: 'Low stock alert at', type: 'number', default: 0 }),
  // Reorder management: when stock falls to/under reorderLevel, the dashboard
  // flags "Order now". leadTimeDays is informational (how long resupply takes).
  field({ name: 'reorderLevel', label: 'Reorder level', type: 'number', default: 0 }),
  field({ name: 'leadTimeDays', label: 'Lead time (days)', type: 'number', default: 0 }),
  // Measurement: 'number' = counted in pieces; 'weight' = entered by weight and
  // converted to pieces using avgWeight. Stock is ALWAYS kept in pieces.
  field({ name: 'measureBy',  label: 'Measured by',          type: 'select', default: 'number',
          options: [{ value: 'number', label: 'Number (pieces)' }, { value: 'weight', label: 'Weight' }] }),
  field({ name: 'avgWeight',  label: 'Avg weight per piece', type: 'number', default: 0 }),
  field({ name: 'weightUnit', label: 'Weight unit',          type: 'text',   default: 'kg' }),
  field({ name: 'source',    label: 'Source',    type: 'select', default: 'purchased',
          options: [
            { value: 'purchased',    label: 'Purchased (outside)' },
            { value: 'manufactured', label: 'Manufactured (in-house)' },
            { value: 'both',         label: 'Both' },
          ] }),
  field({ name: 'sourceApp', label: 'Fed by app', type: 'text', default: '' }),
  // Supplier (for purchased materials) — shown on shortage/reorder alerts.
  field({ name: 'supplierName',  label: 'Supplier',       type: 'text', default: '' }),
  field({ name: 'supplierPhone', label: 'Supplier phone', type: 'text', default: '' }),
  // Purchase cost per piece (₹) for inventory value & material cost per product.
  field({ name: 'unitCost',      label: 'Cost / piece (₹)', type: 'number', default: 0 }),
  // Packing material (e.g. a box) — consumed only for GOOD pieces, not rejects
  // (you don't pack a defective unit).
  field({ name: 'packing',       label: 'Packing material', type: 'toggle', default: false }),
]

/**
 * A final product. `recipe` is an array of { componentId, qty } — how many of
 * each component go into ONE finished piece. Managed by the Setup form.
 */
export const productSchema = [
  field({ name: 'name',        label: 'Product',  type: 'text',   default: '', required: true }),
  field({ name: 'recipe',      label: 'Recipe',   type: 'list',   default: () => [] }),
  // Optional photo: a data-URL set by admin upload. When blank, the UI falls
  // back to a bundled image at products/<code>.jpg, then to a code tile.
  field({ name: 'photo',       label: 'Photo',    type: 'text',   default: '' }),
  // Production targets (pieces). 0 = no target set.
  field({ name: 'targetDay',   label: 'Daily target',   type: 'number', default: 0 }),
  field({ name: 'targetMonth', label: 'Monthly target', type: 'number', default: 0 }),
  // PROVISION (not built yet): a future labour app will compute cost per product
  // from staff salary/days/hours per month and the production qty recorded here.
]

/**
 * A component stock receipt (material coming IN).
 *   source     'purchased' (manual, bought outside) | 'manufactured' (in-house)
 *   sourceApp  which app/process fed it (e.g. 'manual', 'coil-slitter')
 *   ref        external reference from the feeding app (challan/voucher no) —
 *              also used to keep auto-feeds idempotent (no double counting).
 */
export const receiptSchema = [
  field({ name: 'date',          label: 'Date',      type: 'date',   default: todayStr, required: true }),
  field({ name: 'componentId',   label: 'Component', type: 'select', default: '', required: true }),
  field({ name: 'componentName', label: 'Component', type: 'text',   default: '' }),
  field({ name: 'qty',           label: 'Quantity',  type: 'number', default: 0, required: true }),
  // For by-weight receipts: the weight actually entered/weighed (qty stays the
  // derived piece count). Kept for the record and weight cross-checks.
  field({ name: 'weight',        label: 'Weight',    type: 'number', default: 0 }),
  // The average weight per piece used for THIS lot's conversion (may differ
  // from the component's admin standard — avg weight varies lot to lot).
  field({ name: 'avgWeightUsed', label: 'Lot avg wt', type: 'number', default: 0 }),
  // True when this lot's avg weight deviated from the standard beyond tolerance.
  field({ name: 'flagged',       label: 'Flagged',    type: 'toggle', default: false }),
  field({ name: 'source',        label: 'Source',    type: 'select', default: 'purchased',
          options: [
            { value: 'purchased',    label: 'Purchased (outside)' },
            { value: 'manufactured', label: 'Manufactured (in-house)' },
          ] }),
  field({ name: 'sourceApp',     label: 'Fed by',    type: 'text',   default: 'manual' }),
  field({ name: 'ref',           label: 'Reference', type: 'text',   default: '' }),
  field({ name: 'note',          label: 'Note',      type: 'text',   default: '' }),
]

/**
 * A physical stock-take / adjustment. Admin counts the real stock; we record
 * the delta (counted − system-at-time) so computed stock matches reality and
 * the correction is auditable (breakage, miscount, theft, etc.).
 */
export const adjustmentSchema = [
  field({ name: 'date',          label: 'Date',      type: 'date',   default: todayStr, required: true }),
  field({ name: 'componentId',   label: 'Component', type: 'select', default: '', required: true }),
  field({ name: 'componentName', label: 'Component', type: 'text',   default: '' }),
  field({ name: 'counted',       label: 'Counted',   type: 'number', default: 0 }),
  field({ name: 'systemBefore',  label: 'System was', type: 'number', default: 0 }),
  field({ name: 'delta',         label: 'Adjustment', type: 'number', default: 0 }),
  field({ name: 'reason',        label: 'Reason',    type: 'text',   default: '' }),
]

/**
 * A production entry: how many of one product were assembled on a date.
 * `consumed` is a SNAPSHOT of the components used at entry time
 * ([{ componentId, componentName, qty }]) so that later recipe edits never
 * rewrite history.
 */
export const productionSchema = [
  field({ name: 'date',        label: 'Date',     type: 'date',   default: todayStr, required: true }),
  field({ name: 'productId',   label: 'Product',  type: 'select', default: '', required: true }),
  field({ name: 'productName', label: 'Product',  type: 'text',   default: '' }),
  field({ name: 'qty',         label: 'Good',     type: 'number', default: 0, required: true }),
  // Rejected finished pieces (failed QC). They still consumed their materials,
  // so `consumed` is the snapshot for (good + reject).
  field({ name: 'reject',      label: 'Rejected', type: 'number', default: 0 }),
  field({ name: 'consumed',    label: 'Consumed', type: 'list',   default: () => [] }),
]

/**
 * A raw-material reject / scrap — a defective part the floor wants discarded.
 * Stays `pending` until admin approves; only APPROVED rejects reduce stock.
 */
export const rejectSchema = [
  field({ name: 'date',          label: 'Date',      type: 'date',   default: todayStr, required: true }),
  field({ name: 'componentId',   label: 'Component', type: 'select', default: '', required: true }),
  field({ name: 'componentName', label: 'Component', type: 'text',   default: '' }),
  field({ name: 'qty',           label: 'Quantity',  type: 'number', default: 0, required: true }),
  field({ name: 'reason',        label: 'Reason',    type: 'text',   default: '' }),
  field({ name: 'by',            label: 'By',        type: 'text',   default: 'floor' }),
  field({ name: 'status',        label: 'Status',    type: 'select', default: 'pending',
          options: [{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }] }),
]

/**
 * A repaired finished product — a defective unit the floor fixed. Stays
 * `pending` until admin approves; only APPROVED repairs add to ready stock
 * (and reduce the rejected pool).
 */
export const repairSchema = [
  field({ name: 'date',        label: 'Date',     type: 'date',   default: todayStr, required: true }),
  field({ name: 'productId',   label: 'Product',  type: 'select', default: '', required: true }),
  field({ name: 'productName', label: 'Product',  type: 'text',   default: '' }),
  field({ name: 'qty',         label: 'Quantity', type: 'number', default: 0, required: true }),
  field({ name: 'status',      label: 'Status',   type: 'select', default: 'pending',
          options: [{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }] }),
]

/** A dispatch / OUT of finished product — reduces ready stock. */
export const dispatchSchema = [
  field({ name: 'date',        label: 'Date',     type: 'date',   default: todayStr, required: true }),
  field({ name: 'productId',   label: 'Product',  type: 'select', default: '', required: true }),
  field({ name: 'productName', label: 'Product',  type: 'text',   default: '' }),
  field({ name: 'qty',         label: 'Quantity', type: 'number', default: 0, required: true }),
  field({ name: 'note',        label: 'Note',     type: 'text',   default: '' }),
]
