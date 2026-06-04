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

/** A raw component / part. */
export const componentSchema = [
  field({ name: 'name',  label: 'Component', type: 'text',   default: '', required: true }),
  field({ name: 'unit',  label: 'Unit',      type: 'text',   default: 'pcs' }),
  field({ name: 'lowAt', label: 'Low stock alert at', type: 'number', default: 0 }),
]

/**
 * A final product. `recipe` is an array of { componentId, qty } — how many of
 * each component go into ONE finished piece. Managed by the Setup form.
 */
export const productSchema = [
  field({ name: 'name',   label: 'Product', type: 'text', default: '', required: true }),
  field({ name: 'recipe', label: 'Recipe',  type: 'list', default: () => [] }),
]

/** A component stock receipt (stock coming in). */
export const receiptSchema = [
  field({ name: 'date',          label: 'Date',      type: 'date',   default: todayStr, required: true }),
  field({ name: 'componentId',   label: 'Component', type: 'select', default: '', required: true }),
  field({ name: 'componentName', label: 'Component', type: 'text',   default: '' }),
  field({ name: 'qty',           label: 'Quantity',  type: 'number', default: 0, required: true }),
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
