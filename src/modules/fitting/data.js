/**
 * Fitting Assembly — data access. Wires collections to the repository layer.
 * Each collection is normalized against its schema on every read, so adding a
 * field never breaks existing records.
 */
import { createCollection, createSingleton, makeId } from '../../core/db/repository'
import { makeNormalizer } from '../../core/schema/field'
import { componentSchema, productSchema, receiptSchema, productionSchema, adjustmentSchema, rejectSchema, repairSchema, dispatchSchema, rejectReasonSchema } from './schema'
import { KEYS, DEFAULT_PRODUCTS, DEFAULT_COMPONENTS, DEFAULT_REJECT_REASONS } from './config'

export const componentsRepo = createCollection(KEYS.components, {
  seed: () => DEFAULT_COMPONENTS.map((c, i) => ({
    id: makeId('c'), order: i, createdAt: new Date().toISOString(), ...c,
  })),
  normalize: makeNormalizer(componentSchema),
})

/** Seed the catalogue products (empty recipes) for a fresh install. */
export const productsRepo = createCollection(KEYS.products, {
  seed: () => DEFAULT_PRODUCTS.map((name, i) => ({
    id: makeId('p'), name, recipe: [],
    photo: '', targetDay: 0, targetMonth: 0,
    createdAt: new Date().toISOString(), order: i,
  })),
  normalize: makeNormalizer(productSchema),
})

export const receiptsRepo = createCollection(KEYS.receipts, {
  seed: () => [],
  normalize: makeNormalizer(receiptSchema),
})

export const productionRepo = createCollection(KEYS.production, {
  seed: () => [],
  normalize: makeNormalizer(productionSchema),
})

export const adjustmentsRepo = createCollection(KEYS.adjustments, {
  seed: () => [],
  normalize: makeNormalizer(adjustmentSchema),
})

export const rejectsRepo = createCollection(KEYS.rejects, {
  seed: () => [],
  normalize: makeNormalizer(rejectSchema),
})

export const repairsRepo = createCollection(KEYS.repairs, {
  seed: () => [],
  normalize: makeNormalizer(repairSchema),
})

export const dispatchRepo = createCollection(KEYS.dispatch, {
  seed: () => [],
  normalize: makeNormalizer(dispatchSchema),
})

export const rejectReasonsRepo = createCollection(KEYS.rejectReasons, {
  seed: () => DEFAULT_REJECT_REASONS.map((name, i) => ({ id: makeId('rr'), name, order: i })),
  normalize: makeNormalizer(rejectReasonSchema),
})

export const logsRepo = createCollection(KEYS.logs, { seed: () => [] })

export const lastUsedStore = createSingleton(KEYS.lastUsed, {})
