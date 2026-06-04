/**
 * Components & Recipes (admin) — master-data setup.
 *   • Components tab: add/edit/delete components, set unit, opening stock and a
 *     low-stock alert level. Opening stock is recorded as a receipt.
 *   • Products tab: rename products and define each product's recipe
 *     (which components + how many per finished piece).
 * Password-gated so the floor worker cannot change recipes.
 */
import { useMemo, useState } from 'react'
import {
  Button, Card, FieldLabel, TextInput, NumberInput, Select, SearchBar, useToast, Toast,
} from '../../../core/ui'
import { todayStr, fmtNum, fmtDec } from '../../../core/utils/format'
import { useFitting } from '../FittingContext'
import { computeStock, piecesFromWeight, materialCostOf } from '../logic/stock'
import { compressImage } from '../logic/image'
import ProductPhoto from '../components/ProductPhoto'
import { useRef } from 'react'

/** Small coloured tag showing where a component comes from. */
export function SourceBadge({ source }) {
  const map = {
    purchased:    ['Bought', 'bg-sky-100 text-sky-700'],
    manufactured: ['Made',   'bg-amber-100 text-amber-700'],
    both:         ['Both',   'bg-violet-100 text-violet-700'],
  }
  const [label, cls] = map[source] || map.purchased
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}`}>{label}</span>
}

function ComponentsTab() {
  const { components, products, receipts, production, adjustments, log } = useFitting()
  const { msg, show } = useToast()
  const stockMap = useMemo(
    () => computeStock(components.list, receipts.list, production.list, adjustments.list),
    [components.list, receipts.list, production.list, adjustments.list]
  )

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('pcs')
  const [opening, setOpening] = useState('')
  const [lowAt, setLowAt] = useState('')
  const [source, setSource] = useState('purchased')
  const [sourceApp, setSourceApp] = useState('')
  const [measureBy, setMeasureBy] = useState('number')
  const [avgWeight, setAvgWeight] = useState('')
  const [weightUnit, setWeightUnit] = useState('kg')
  const [reorderLevel, setReorderLevel] = useState('')
  const [leadTime, setLeadTime] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [supplierPhone, setSupplierPhone] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [editId, setEditId] = useState(null)
  const [bulk, setBulk] = useState(null)     // component being added to all products
  const [bulkQty, setBulkQty] = useState('1')

  const SOURCE_OPTS = [
    { value: 'purchased', label: 'Purchased (outside)' },
    { value: 'manufactured', label: 'Manufactured (in-house)' },
    { value: 'both', label: 'Both' },
  ]
  const MEASURE_OPTS = [
    { value: 'number', label: 'Number (pieces)' },
    { value: 'weight', label: 'Weight' },
  ]
  const categoryNames = [...new Set(components.list.map(c => c.category).filter(Boolean))].sort()
  // Group components by category for the list ('Other' for uncategorised).
  const grouped = {}
  for (const c of components.list) { const k = c.category || 'Other'; (grouped[k] ||= []).push(c) }
  const groupNames = Object.keys(grouped).sort((a, b) => (a === 'Other') - (b === 'Other') || a.localeCompare(b))
  const renderRow = (c) => (
    <div key={c.id} className="bg-slate-50 rounded-xl px-4 py-3">
      {editId === c.id ? (
        <EditComponentRow c={c} onCancel={() => setEditId(null)} onSave={saveEdit} />
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-slate-700 flex items-center gap-1.5 flex-wrap">
              {c.name} <span className="text-xs text-slate-400">({c.unit})</span>
              <SourceBadge source={c.source} />
              {c.measureBy === 'weight' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">⚖ {fmtDec(c.avgWeight)}{c.weightUnit || 'kg'}/pc</span>}
              {stockMap[c.id]?.reorder && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">REORDER</span>}
            </div>
            <div className="text-xs text-slate-400">
              stock {fmtNum(stockMap[c.id]?.stock ?? 0)} pcs
              {c.measureBy === 'weight' && c.avgWeight > 0 ? ` (≈ ${fmtDec((stockMap[c.id]?.stock ?? 0) * c.avgWeight)} ${c.weightUnit || 'kg'})` : ''}
              {' · low '}{fmtNum(c.lowAt)}{c.reorderLevel > 0 ? ` · reorder ${fmtNum(c.reorderLevel)}` : ''}
              {c.unitCost > 0 ? ` · ₹${fmtNum(c.unitCost)}/pc` : ''}{c.supplierName ? ` · ${c.supplierName}` : ''}
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => { setBulk(c); setBulkQty('1') }} className="text-violet-600 text-xs font-bold px-1.5" title="Add to all products">＋All</button>
            <button onClick={() => setEditId(c.id)} className="text-blue-600 text-sm font-bold px-1.5">Edit</button>
            <button onClick={() => del(c)} className="text-red-500 text-sm font-bold px-1.5">Del</button>
          </div>
        </div>
      )}
    </div>
  )

  // For weight materials the "opening" field is a weight → convert to pieces.
  const byWeight = measureBy === 'weight'
  const openingPieces = byWeight ? piecesFromWeight(avgWeight, opening) : (Number(opening) || 0)

  const add = () => {
    const nm = name.trim()
    if (!nm) return show('Enter a component name', 2000)
    if (components.list.some(c => c.name.toLowerCase() === nm.toLowerCase())) return show('Already exists', 2000)
    if (byWeight && !(Number(avgWeight) > 0)) return show('Enter avg weight per piece', 2500)
    const row = components.insert({
      name: nm, category: category.trim(), unit: unit.trim() || 'pcs', lowAt: Number(lowAt) || 0, source, sourceApp: sourceApp.trim(),
      measureBy, avgWeight: byWeight ? Number(avgWeight) || 0 : 0, weightUnit: weightUnit.trim() || 'kg',
      reorderLevel: Number(reorderLevel) || 0, leadTimeDays: Number(leadTime) || 0,
      supplierName: supplierName.trim(), supplierPhone: supplierPhone.trim(), unitCost: Number(unitCost) || 0,
    })
    if (openingPieces > 0) {
      receipts.insert({
        date: todayStr(), componentId: row.id, componentName: row.name,
        qty: openingPieces, weight: byWeight ? Number(opening) || 0 : 0,
        source: source === 'manufactured' ? 'manufactured' : 'purchased', sourceApp: 'manual', note: 'Opening stock',
      })
    }
    log('ADD_COMPONENT', `${nm} [${measureBy}]${openingPieces ? ` (opening ${openingPieces}pc)` : ''}`, 'admin')
    show('Component added ✓')
    setName(''); setCategory(''); setUnit('pcs'); setOpening(''); setLowAt(''); setSource('purchased'); setSourceApp('')
    setMeasureBy('number'); setAvgWeight(''); setWeightUnit('kg')
    setReorderLevel(''); setLeadTime(''); setSupplierName(''); setSupplierPhone(''); setUnitCost('')
  }

  const saveEdit = (c, patch) => {
    components.update(c.id, patch)
    log('EDIT_COMPONENT', `${c.name}`, 'admin')
    setEditId(null)
    show('Saved ✓')
  }

  const del = (c) => {
    if (!confirm(`Delete component "${c.name}"? Past entries that used it stay intact.`)) return
    components.remove(c.id)
    log('DELETE_COMPONENT', c.name, 'admin')
    show('Deleted ✓')
  }

  // Add this raw material to EVERY product's recipe in one tap (skips products
  // that already contain it, so existing quantities are never overwritten).
  const addToAllProducts = () => {
    const qn = Number(bulkQty) || 0
    if (qn <= 0) return show('Enter a quantity', 2000)
    let added = 0
    products.list.forEach(p => {
      const recipe = Array.isArray(p.recipe) ? p.recipe : []
      if (recipe.some(r => r.componentId === bulk.id)) return
      products.update(p.id, { recipe: [...recipe, { componentId: bulk.id, qty: qn }] })
      added++
    })
    log('RECIPE_BULK', `${bulk.name} → ${added} products @ ${qn}/pc`, 'admin')
    show(`Added to ${added} product(s) ✓`)
    setBulk(null); setBulkQty('1')
  }

  return (
    <div className="space-y-4">
      <Toast msg={msg} />
      <Card className="p-5 space-y-3">
        <FieldLabel>Add Component</FieldLabel>
        <TextInput placeholder="Component name (e.g. M8 Bolt)" value={name} onChange={e => setName(e.target.value)} />
        <div>
          <FieldLabel>Category</FieldLabel>
          <input list="fa-cats" placeholder="e.g. Nylon Bush, Box, Rivet…" value={category} onChange={e => setCategory(e.target.value)}
            className="mt-1 w-full border-2 border-slate-300 rounded-2xl px-4 py-3 text-base font-semibold focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-500" />
          <datalist id="fa-cats">{categoryNames.map(c => <option key={c} value={c} />)}</datalist>
        </div>
        <div>
          <FieldLabel>Measured by</FieldLabel>
          <Select className="mt-1" value={measureBy} onChange={e => setMeasureBy(e.target.value)} options={MEASURE_OPTS} />
        </div>
        {byWeight && (
          <div className="grid grid-cols-2 gap-2 bg-amber-50 rounded-xl p-3">
            <div><FieldLabel>Avg weight / piece</FieldLabel><NumberInput className="mt-1" placeholder="e.g. 0.25" value={avgWeight} onChange={e => setAvgWeight(e.target.value)} /></div>
            <div><FieldLabel>Weight unit</FieldLabel><TextInput className="mt-1" placeholder="kg" value={weightUnit} onChange={e => setWeightUnit(e.target.value)} /></div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <div><FieldLabel>Unit</FieldLabel><TextInput className="mt-1" placeholder="pcs" value={unit} onChange={e => setUnit(e.target.value)} /></div>
          <div>
            <FieldLabel>{byWeight ? `Opening (${weightUnit || 'kg'})` : 'Opening stock'}</FieldLabel>
            <NumberInput className="mt-1" placeholder="0" value={opening} onChange={e => setOpening(e.target.value)} />
          </div>
          <div><FieldLabel>Low at (pcs)</FieldLabel><NumberInput className="mt-1" placeholder="0" value={lowAt} onChange={e => setLowAt(e.target.value)} /></div>
        </div>
        {byWeight && Number(opening) > 0 && (
          <p className="text-xs text-amber-700 -mt-1">≈ {fmtNum(openingPieces)} pcs opening (from {opening} {weightUnit || 'kg'})</p>
        )}
        <div>
          <FieldLabel>Source</FieldLabel>
          <Select className="mt-1" value={source} onChange={e => setSource(e.target.value)} options={SOURCE_OPTS} />
        </div>
        {source !== 'purchased' && (
          <div>
            <FieldLabel>Fed by app (optional)</FieldLabel>
            <TextInput className="mt-1" placeholder="e.g. coil-slitter" value={sourceApp} onChange={e => setSourceApp(e.target.value)} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div><FieldLabel>Reorder level (pcs)</FieldLabel><NumberInput className="mt-1" placeholder="0" value={reorderLevel} onChange={e => setReorderLevel(e.target.value)} /></div>
          <div><FieldLabel>Lead time (days)</FieldLabel><NumberInput className="mt-1" placeholder="0" value={leadTime} onChange={e => setLeadTime(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><FieldLabel>Supplier</FieldLabel><TextInput className="mt-1" placeholder="name" value={supplierName} onChange={e => setSupplierName(e.target.value)} /></div>
          <div><FieldLabel>Supplier phone</FieldLabel><TextInput className="mt-1" placeholder="phone" value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)} /></div>
        </div>
        <div><FieldLabel>Cost / piece (₹)</FieldLabel><NumberInput className="mt-1" placeholder="0" value={unitCost} onChange={e => setUnitCost(e.target.value)} /></div>
        <Button variant="primary" className="w-full" onClick={add}>Add Component</Button>
      </Card>

      <Card className="p-5">
        <FieldLabel>Components ({components.list.length})</FieldLabel>
        {components.list.length === 0 ? (
          <p className="text-sm text-slate-400 mt-3">None yet — add your first component above.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {groupNames.map(g => (
              <div key={g}>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">{g} ({grouped[g].length})</div>
                <div className="space-y-2">
                  {[...grouped[g]].sort((a, b) => a.name.localeCompare(b.name)).map(renderRow)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add-to-all-products sheet */}
      {bulk && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-40 p-4" onClick={() => setBulk(null)}>
          <Card className="p-5 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <FieldLabel>Add “{bulk.name}” to all products</FieldLabel>
            <p className="text-xs text-slate-400 -mt-1">Adds it to every product's recipe at the quantity below. Products that already include it are left unchanged.</p>
            <div>
              <FieldLabel>Quantity per piece</FieldLabel>
              <NumberInput className="mt-1" value={bulkQty} onChange={e => setBulkQty(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setBulk(null)}>Cancel</Button>
              <Button variant="success" className="flex-1" onClick={addToAllProducts}>Add to {products.list.length} products</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function EditComponentRow({ c, onCancel, onSave }) {
  const [name, setName] = useState(c.name)
  const [category, setCategory] = useState(c.category || '')
  const [unit, setUnit] = useState(c.unit)
  const [lowAt, setLowAt] = useState(String(c.lowAt ?? 0))
  const [source, setSource] = useState(c.source || 'purchased')
  const [sourceApp, setSourceApp] = useState(c.sourceApp || '')
  const [measureBy, setMeasureBy] = useState(c.measureBy || 'number')
  const [avgWeight, setAvgWeight] = useState(String(c.avgWeight ?? 0))
  const [weightUnit, setWeightUnit] = useState(c.weightUnit || 'kg')
  const [reorderLevel, setReorderLevel] = useState(String(c.reorderLevel ?? 0))
  const [leadTime, setLeadTime] = useState(String(c.leadTimeDays ?? 0))
  const [supplierName, setSupplierName] = useState(c.supplierName || '')
  const [supplierPhone, setSupplierPhone] = useState(c.supplierPhone || '')
  const [unitCost, setUnitCost] = useState(String(c.unitCost ?? 0))
  const SOURCE_OPTS = [
    { value: 'purchased', label: 'Purchased (outside)' },
    { value: 'manufactured', label: 'Manufactured (in-house)' },
    { value: 'both', label: 'Both' },
  ]
  const MEASURE_OPTS = [
    { value: 'number', label: 'Number (pieces)' },
    { value: 'weight', label: 'Weight' },
  ]
  return (
    <div className="space-y-2">
      <TextInput value={name} onChange={e => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <div><FieldLabel>Category</FieldLabel><input list="fa-cats" className="mt-1 w-full border-2 border-slate-300 rounded-2xl px-4 py-3 text-base font-semibold focus:outline-none focus:ring-4 focus:ring-blue-200" value={category} onChange={e => setCategory(e.target.value)} /></div>
        <div><FieldLabel>Unit</FieldLabel><TextInput className="mt-1" value={unit} onChange={e => setUnit(e.target.value)} /></div>
      </div>
      <div><FieldLabel>Low at (pcs)</FieldLabel><NumberInput className="mt-1" value={lowAt} onChange={e => setLowAt(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><FieldLabel>Reorder level</FieldLabel><NumberInput className="mt-1" value={reorderLevel} onChange={e => setReorderLevel(e.target.value)} /></div>
        <div><FieldLabel>Lead time (days)</FieldLabel><NumberInput className="mt-1" value={leadTime} onChange={e => setLeadTime(e.target.value)} /></div>
      </div>
      <div><FieldLabel>Measured by</FieldLabel><Select className="mt-1" value={measureBy} onChange={e => setMeasureBy(e.target.value)} options={MEASURE_OPTS} /></div>
      {measureBy === 'weight' && (
        <div className="grid grid-cols-2 gap-2 bg-amber-50 rounded-xl p-2">
          <div><FieldLabel>Avg wt / piece</FieldLabel><NumberInput className="mt-1" value={avgWeight} onChange={e => setAvgWeight(e.target.value)} /></div>
          <div><FieldLabel>Weight unit</FieldLabel><TextInput className="mt-1" value={weightUnit} onChange={e => setWeightUnit(e.target.value)} /></div>
        </div>
      )}
      <div><FieldLabel>Source</FieldLabel><Select className="mt-1" value={source} onChange={e => setSource(e.target.value)} options={SOURCE_OPTS} /></div>
      {source !== 'purchased' && (
        <div><FieldLabel>Fed by app</FieldLabel><TextInput className="mt-1" placeholder="e.g. coil-slitter" value={sourceApp} onChange={e => setSourceApp(e.target.value)} /></div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div><FieldLabel>Supplier</FieldLabel><TextInput className="mt-1" value={supplierName} onChange={e => setSupplierName(e.target.value)} /></div>
        <div><FieldLabel>Supplier phone</FieldLabel><TextInput className="mt-1" value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)} /></div>
      </div>
      <div><FieldLabel>Cost / piece (₹)</FieldLabel><NumberInput className="mt-1" value={unitCost} onChange={e => setUnitCost(e.target.value)} /></div>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button size="sm" variant="success" className="flex-1" onClick={() => onSave(c, {
          name: name.trim() || c.name, category: category.trim(), unit: unit.trim() || 'pcs', lowAt: Number(lowAt) || 0, source, sourceApp: sourceApp.trim(),
          measureBy, avgWeight: measureBy === 'weight' ? Number(avgWeight) || 0 : 0, weightUnit: weightUnit.trim() || 'kg',
          reorderLevel: Number(reorderLevel) || 0, leadTimeDays: Number(leadTime) || 0,
          supplierName: supplierName.trim(), supplierPhone: supplierPhone.trim(), unitCost: Number(unitCost) || 0,
        })}>Save</Button>
      </div>
    </div>
  )
}

function ProductsTab() {
  const { products, components, log } = useFitting()
  const { msg, show } = useToast()
  const [editId, setEditId] = useState(null)
  const [newName, setNewName] = useState('')
  const [pSearch, setPSearch] = useState('')

  const sorted = [...products.list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
  const shown = sorted.filter(p => !pSearch.trim() || p.name.toLowerCase().includes(pSearch.trim().toLowerCase()))

  const addProduct = () => {
    const nm = newName.trim()
    if (!nm) return show('Enter a product name', 2000)
    products.insert({ name: nm, recipe: [], order: products.list.length })
    log('ADD_PRODUCT', nm, 'admin')
    show('Product added ✓')
    setNewName('')
  }

  const delProduct = (p) => {
    if (!confirm(`Delete product "${p.name}"? Past production stays intact.`)) return
    products.remove(p.id)
    log('DELETE_PRODUCT', p.name, 'admin')
    show('Deleted ✓')
  }

  return (
    <div className="space-y-4">
      <Toast msg={msg} />
      <Card className="p-5 space-y-3">
        <FieldLabel>Add Product</FieldLabel>
        <div className="flex gap-2">
          <TextInput placeholder="New product name" value={newName} onChange={e => setNewName(e.target.value)} />
          <Button variant="primary" onClick={addProduct}>Add</Button>
        </div>
      </Card>

      {sorted.length > 6 && (
        <SearchBar value={pSearch} onChange={setPSearch} placeholder={`Search ${sorted.length} products…`} />
      )}

      {shown.map(p => (
        <Card key={p.id} className="p-5">
          {editId === p.id ? (
            <RecipeEditor product={p} components={components.list}
              onCancel={() => setEditId(null)}
              onSave={(patch) => { products.update(p.id, patch); log('EDIT_RECIPE', p.name, 'admin'); show('Recipe saved ✓'); setEditId(null) }} />
          ) : (
            <div>
              <div className="flex items-start gap-3">
                <ProductPhoto product={p} className="w-14 h-14 flex-shrink-0 border border-slate-200" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-800 truncate">{p.name}</div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => setEditId(p.id)} className="text-blue-600 text-sm font-bold px-2">Edit</button>
                      <button onClick={() => delProduct(p)} className="text-red-500 text-sm font-bold px-2">Del</button>
                    </div>
                  </div>
                  {(p.targetDay > 0 || p.targetMonth > 0) && (
                    <div className="text-xs text-slate-400 mt-0.5">target {p.targetDay > 0 ? `${fmtNum(p.targetDay)}/day` : ''}{p.targetDay > 0 && p.targetMonth > 0 ? ' · ' : ''}{p.targetMonth > 0 ? `${fmtNum(p.targetMonth)}/mo` : ''}</div>
                  )}
                </div>
              </div>
              <div className="mt-2 text-sm text-slate-500">
                {(p.recipe || []).length === 0
                  ? <span className="text-amber-600">No recipe set</span>
                  : (p.recipe || []).map((r, i) => {
                      const c = components.list.find(c => c.id === r.componentId)
                      const label = r.perBox > 0 ? `${c?.name || '??'} · 1 / ${fmtNum(r.perBox)} box` : `${c?.name || '??'} × ${fmtDec(r.qty)}`
                      return <span key={i} className="inline-block bg-slate-100 rounded-lg px-2 py-1 mr-1.5 mb-1.5 text-xs font-semibold">{label}</span>
                    })}
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

/**
 * RecipeEditor — pick a product's raw materials from the master list, like
 * choosing ice-cream toppings: every available material shows with a ＋ to add
 * it, then you set how many go into one finished piece. Materials shared across
 * products are simply the same entries, reused per product.
 */
function RecipeEditor({ product, components, onCancel, onSave }) {
  const [name, setName] = useState(product.name)
  // Recipe state: id → { mode:'pc'|'box', val }. 'pc' = qty per finished piece;
  // 'box' = how many pieces ONE box packs (qty becomes 1/val box per piece).
  const [recipe, setRecipe] = useState(() => {
    const m = {}
    ;(product.recipe || []).forEach(r => {
      if (!r.componentId) return
      m[r.componentId] = Number(r.perBox) > 0 ? { mode: 'box', val: Number(r.perBox) } : { mode: 'pc', val: Number(r.qty) || 0 }
    })
    return m
  })
  const [q, setQ] = useState('')
  const [photo, setPhoto] = useState(product.photo || '')
  const [targetDay, setTargetDay] = useState(String(product.targetDay ?? 0))
  const [targetMonth, setTargetMonth] = useState(String(product.targetMonth ?? 0))
  const fileRef = useRef(null)

  const inRecipe = (id) => Object.prototype.hasOwnProperty.call(recipe, id)
  const addItem = (id) => setRecipe(r => ({ ...r, [id]: r[id] || { mode: 'pc', val: 1 } }))
  const removeItem = (id) => setRecipe(r => { const n = { ...r }; delete n[id]; return n })
  const setVal = (id, v) => setRecipe(r => ({ ...r, [id]: { ...r[id], val: v } }))
  const toggleMode = (id) => setRecipe(r => ({ ...r, [id]: { ...r[id], mode: r[id].mode === 'box' ? 'pc' : 'box' } }))

  const byName = (a, b) => a.name.localeCompare(b.name)
  const selected = components.filter(c => inRecipe(c.id)).sort(byName)
  const term = q.trim().toLowerCase()
  const available = components
    .filter(c => !inRecipe(c.id))
    .filter(c => !term || c.name.toLowerCase().includes(term))
    .sort(byName)

  // Convert UI state → stored recipe items (qty is always per finished piece).
  const builtRecipe = Object.entries(recipe)
    .filter(([, v]) => Number(v.val) > 0)
    .map(([componentId, v]) => v.mode === 'box'
      ? { componentId, qty: 1 / Number(v.val), perBox: Number(v.val) }
      : { componentId, qty: Number(v.val) })
  const matCost = materialCostOf({ recipe: builtRecipe }, components)

  const onPickPhoto = async (e) => {
    const f = e.target.files?.[0]
    if (f) setPhoto(await compressImage(f))
    if (fileRef.current) fileRef.current.value = ''
  }

  const save = () => {
    onSave({
      name: name.trim() || product.name, recipe: builtRecipe, photo,
      targetDay: Number(targetDay) || 0, targetMonth: Number(targetMonth) || 0,
    })
  }

  return (
    <div className="space-y-3">
      {/* Photo + name */}
      <div className="flex gap-3">
        <ProductPhoto product={{ ...product, photo, name }} className="w-20 h-20 flex-shrink-0 border border-slate-200" />
        <div className="flex-1 space-y-2">
          <div>
            <FieldLabel>Product name</FieldLabel>
            <TextInput className="mt-1" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="neutral" className="flex-1" onClick={() => fileRef.current?.click()}>📷 Photo</Button>
            {photo && <Button size="sm" variant="ghost" onClick={() => setPhoto('')}>Reset</Button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
        </div>
      </div>

      {/* Targets */}
      <div className="grid grid-cols-2 gap-2">
        <div><FieldLabel>Daily target</FieldLabel><NumberInput className="mt-1" placeholder="0" value={targetDay} onChange={e => setTargetDay(e.target.value)} /></div>
        <div><FieldLabel>Monthly target</FieldLabel><NumberInput className="mt-1" placeholder="0" value={targetMonth} onChange={e => setTargetMonth(e.target.value)} /></div>
      </div>

      {matCost > 0 && (
        <div className="text-xs font-semibold text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
          Material cost ≈ <span className="text-slate-800">₹{fmtNum(matCost)}/piece</span> (from recipe)
        </div>
      )}

      {components.length === 0 ? (
        <p className="text-sm text-amber-600">Add your raw materials in the <b>Components</b> tab first, then come back to pick them here.</p>
      ) : (
        <>
          {/* Selected raw materials (this product's recipe) */}
          <FieldLabel>Raw materials in this product ({selected.length})</FieldLabel>
          {selected.length === 0 ? (
            <p className="text-xs text-slate-400">None yet — tap ＋ on a material below to add it.</p>
          ) : (
            <div className="space-y-2">
              {selected.map(c => {
                const item = recipe[c.id]
                return (
                  <div key={c.id} className="bg-emerald-50 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 font-semibold text-slate-700 text-sm">{c.name}</span>
                      <NumberInput className="w-16 text-center !py-2" value={item.val} onChange={e => setVal(c.id, e.target.value)} />
                      <button onClick={() => toggleMode(c.id)} title="Switch per-piece / items-per-box"
                        className={`text-xs font-bold px-2 py-2 rounded-lg w-16 border ${item.mode === 'box' ? 'bg-amber-100 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                        {item.mode === 'box' ? '/box' : '/pc'}
                      </button>
                      <button onClick={() => removeItem(c.id)} className="w-9 h-9 rounded-xl bg-red-50 text-red-500 font-bold flex-shrink-0">✕</button>
                    </div>
                    {item.mode === 'box' && Number(item.val) > 0 && (
                      <div className="text-[11px] text-amber-700 mt-1">1 box packs {fmtNum(item.val)} pcs · so {fmtDec(1 / Number(item.val))} box per piece</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Available raw materials to add (toppings picker) */}
          <FieldLabel>Add raw material</FieldLabel>
          <SearchBar value={q} onChange={setQ} placeholder="Search raw material…" />
          <div className="space-y-1.5 max-h-72 overflow-auto">
            {available.length === 0 ? (
              <p className="text-xs text-slate-400 px-1">{term ? 'No match.' : 'All materials added.'}</p>
            ) : available.map(c => (
              <button key={c.id} onClick={() => addItem(c.id)}
                className="w-full flex items-center gap-2 bg-slate-50 hover:bg-slate-100 rounded-xl px-3 py-2.5 text-left active:scale-[0.99]">
                <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">+</span>
                <span className="flex-1 font-semibold text-slate-700 text-sm">{c.name} <span className="text-xs text-slate-400">({c.unit})</span></span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button variant="success" className="flex-1" onClick={save}>Save Recipe</Button>
      </div>
    </div>
  )
}

export default function Setup() {
  const [tab, setTab] = useState('components')
  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex gap-2 bg-slate-100 rounded-2xl p-1">
        {['components', 'products'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold capitalize transition-colors ${tab === t ? 'bg-white shadow text-violet-700' : 'text-slate-500'}`}>
            {t === 'components' ? 'Components' : 'Products & Recipes'}
          </button>
        ))}
      </div>
      {tab === 'components' ? <ComponentsTab /> : <ProductsTab />}
    </div>
  )
}
