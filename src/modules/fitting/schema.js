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
  field({ name: 'unit',      label: 'Unit',      type: 'text',   default: 'pcs' }),
  field({ name: 'lowAt',     label: 'Low stock alert at', type: 'number', default: 0 }),
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
]

/**
 * A final product. `recipe` is an array of { componentId, qty } — how many of
 * each component go into ONE finished piece. Managed by the Setup form.
 */
export const productSchema = [
  field({ name: 'name',   label: 'Product', type: 'text', default: '', required: true }),
  field({ name: 'recipe', label: 'Recipe',  type: 'list', default: () => [] }),
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
 * A production entry: how many of one product were assembled on a date.
 * `consumed` is a SNAPSHOT of the components used at entry time
 * ([{ componentId, componentName, qty }]) so that later recipe edits never
 * rewrite history.
 */
export const productionSchema = [
  field({ name: 'date',        label: 'Date',     type: 'date',   default: todayStr, required: true }),
  field({ name: 'productId',   label: 'Product',  type: 'select', default: '', required: true }),
  field({ name: 'productName', label: 'Product',  type: 'text',   default: '' }),
  field({ name: 'qty',         label: 'Quantity', type: 'number', default: 0, required: true }),
  field({ name: 'consumed',    label: 'Consumed', type: 'list',   default: () => [] }),
]
