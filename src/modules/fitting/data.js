/**
 * Fitting Assembly — data access. Wires collections to the repository layer.
 * Each collection is normalized against its schema on every read, so adding a
 * field never breaks existing records.
 */
import { createCollection, createSingleton, makeId } from '../../core/db/repository'
import { makeNormalizer } from '../../core/schema/field'
import { componentSchema, productSchema, receiptSchema, productionSchema } from './schema'
import { KEYS, DEFAULT_PRODUCTS } from './config'

export const componentsRepo = createCollection(KEYS.components, {
  seed: () => [],
  normalize: makeNormalizer(componentSchema),
})

/** Seed 10 placeholder products (empty recipes) for a fresh install. */
export const productsRepo = createCollection(KEYS.products, {
  seed: () => DEFAULT_PRODUCTS.map((name, i) => ({
    id: makeId('p'), name, recipe: [], createdAt: new Date().toISOString(), order: i,
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

export const logsRepo = createCollection(KEYS.logs, { seed: () => [] })

export const lastUsedStore = createSingleton(KEYS.lastUsed, {})
