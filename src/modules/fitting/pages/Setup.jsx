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
  Button, Card, FieldLabel, TextInput, NumberInput, Select, useToast, Toast,
} from '../../../core/ui'
import { todayStr, fmtNum, fmtDec } from '../../../core/utils/format'
import { useFitting } from '../FittingContext'
import { computeStock, piecesFromWeight } from '../logic/stock'

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
  const { components, receipts, production, log } = useFitting()
  const { msg, show } = useToast()
  const stockMap = useMemo(
    () => computeStock(components.list, receipts.list, production.list),
    [components.list, receipts.list, production.list]
  )

  const [name, setName] = useState('')
  const [unit, setUnit] = useState('pcs')
  const [opening, setOpening] = useState('')
  const [lowAt, setLowAt] = useState('')
  const [source, setSource] = useState('purchased')
  const [sourceApp, setSourceApp] = useState('')
  const [measureBy, setMeasureBy] = useState('number')
  const [avgWeight, setAvgWeight] = useState('')
  const [weightUnit, setWeightUnit] = useState('kg')
  const [editId, setEditId] = useState(null)

  const SOURCE_OPTS = [
    { value: 'purchased', label: 'Purchased (outside)' },
    { value: 'manufactured', label: 'Manufactured (in-house)' },
    { value: 'both', label: 'Both' },
  ]
  const MEASURE_OPTS = [
    { value: 'number', label: 'Number (pieces)' },
    { value: 'weight', label: 'Weight' },
  ]

  // For weight materials the "opening" field is a weight → convert to pieces.
  const byWeight = measureBy === 'weight'
  const openingPieces = byWeight ? piecesFromWeight(avgWeight, opening) : (Number(opening) || 0)

  const add = () => {
    const nm = name.trim()
    if (!nm) return show('Enter a component name', 2000)
    if (components.list.some(c => c.name.toLowerCase() === nm.toLowerCase())) return show('Already exists', 2000)
    if (byWeight && !(Number(avgWeight) > 0)) return show('Enter avg weight per piece', 2500)
    const row = components.insert({
      name: nm, unit: unit.trim() || 'pcs', lowAt: Number(lowAt) || 0, source, sourceApp: sourceApp.trim(),
      measureBy, avgWeight: byWeight ? Number(avgWeight) || 0 : 0, weightUnit: weightUnit.trim() || 'kg',
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
    setName(''); setUnit('pcs'); setOpening(''); setLowAt(''); setSource('purchased'); setSourceApp('')
    setMeasureBy('number'); setAvgWeight(''); setWeightUnit('kg')
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

  return (
    <div className="space-y-4">
      <Toast msg={msg} />
      <Card className="p-5 space-y-3">
        <FieldLabel>Add Component</FieldLabel>
        <TextInput placeholder="Component name (e.g. M8 Bolt)" value={name} onChange={e => setName(e.target.value)} />
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
        <Button variant="primary" className="w-full" onClick={add}>Add Component</Button>
      </Card>

      <Card className="p-5">
        <FieldLabel>Components ({components.list.length})</FieldLabel>
        {components.list.length === 0 ? (
          <p className="text-sm text-slate-400 mt-3">None yet — add your first component above.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {[...components.list].sort((a, b) => a.name.localeCompare(b.name)).map(c => (
              <div key={c.id} className="bg-slate-50 rounded-xl px-4 py-3">
                {editId === c.id ? (
                  <EditComponentRow c={c} onCancel={() => setEditId(null)} onSave={saveEdit} />
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                        {c.name} <span className="text-xs text-slate-400">({c.unit})</span>
                        <SourceBadge source={c.source} />
                        {c.measureBy === 'weight' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">⚖ {fmtDec(c.avgWeight)}{c.weightUnit || 'kg'}/pc</span>}
                      </div>
                      <div className="text-xs text-slate-400">
                        stock {fmtNum(stockMap[c.id]?.stock ?? 0)} pcs
                        {c.measureBy === 'weight' && c.avgWeight > 0 ? ` (≈ ${fmtDec((stockMap[c.id]?.stock ?? 0) * c.avgWeight)} ${c.weightUnit || 'kg'})` : ''}
                        {' · low at '}{fmtNum(c.lowAt)}{c.sourceApp ? ` · fed by ${c.sourceApp}` : ''}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => setEditId(c.id)} className="text-blue-600 text-sm font-bold px-2">Edit</button>
                      <button onClick={() => del(c)} className="text-red-500 text-sm font-bold px-2">Del</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function EditComponentRow({ c, onCancel, onSave }) {
  const [name, setName] = useState(c.name)
  const [unit, setUnit] = useState(c.unit)
  const [lowAt, setLowAt] = useState(String(c.lowAt ?? 0))
  const [source, setSource] = useState(c.source || 'purchased')
  const [sourceApp, setSourceApp] = useState(c.sourceApp || '')
  const [measureBy, setMeasureBy] = useState(c.measureBy || 'number')
  const [avgWeight, setAvgWeight] = useState(String(c.avgWeight ?? 0))
  const [weightUnit, setWeightUnit] = useState(c.weightUnit || 'kg')
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
        <div><FieldLabel>Unit</FieldLabel><TextInput className="mt-1" value={unit} onChange={e => setUnit(e.target.value)} /></div>
        <div><FieldLabel>Low at (pcs)</FieldLabel><NumberInput className="mt-1" value={lowAt} onChange={e => setLowAt(e.target.value)} /></div>
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
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button size="sm" variant="success" className="flex-1" onClick={() => onSave(c, {
          name: name.trim() || c.name, unit: unit.trim() || 'pcs', lowAt: Number(lowAt) || 0, source, sourceApp: sourceApp.trim(),
          measureBy, avgWeight: measureBy === 'weight' ? Number(avgWeight) || 0 : 0, weightUnit: weightUnit.trim() || 'kg',
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

  const sorted = [...products.list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))

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

      {sorted.map(p => (
        <Card key={p.id} className="p-5">
          {editId === p.id ? (
            <RecipeEditor product={p} components={components.list}
              onCancel={() => setEditId(null)}
              onSave={(patch) => { products.update(p.id, patch); log('EDIT_RECIPE', p.name, 'admin'); show('Recipe saved ✓'); setEditId(null) }} />
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-800">{p.name}</div>
                <div className="flex gap-1.5">
                  <button onClick={() => setEditId(p.id)} className="text-blue-600 text-sm font-bold px-2">Edit</button>
                  <button onClick={() => delProduct(p)} className="text-red-500 text-sm font-bold px-2">Del</button>
                </div>
              </div>
              <div className="mt-2 text-sm text-slate-500">
                {(p.recipe || []).length === 0
                  ? <span className="text-amber-600">No recipe set</span>
                  : (p.recipe || []).map((r, i) => {
                      const c = components.list.find(c => c.id === r.componentId)
                      return <span key={i} className="inline-block bg-slate-100 rounded-lg px-2 py-1 mr-1.5 mb-1.5 text-xs font-semibold">{c?.name || '??'} × {fmtNum(r.qty)}</span>
                    })}
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

function RecipeEditor({ product, components, onCancel, onSave }) {
  const [name, setName] = useState(product.name)
  const [rows, setRows] = useState(() => (product.recipe || []).map(r => ({ ...r })))

  const compOptions = [{ value: '', label: '— pick component —' }, ...components.map(c => ({ value: c.id, label: c.name }))]
  const setRow = (i, patch) => setRows(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const addRow = () => setRows([...rows, { componentId: '', qty: 1 }])
  const delRow = (i) => setRows(rows.filter((_, idx) => idx !== i))

  const save = () => {
    const recipe = rows
      .filter(r => r.componentId && Number(r.qty) > 0)
      .map(r => ({ componentId: r.componentId, qty: Number(r.qty) }))
    onSave({ name: name.trim() || product.name, recipe })
  }

  return (
    <div className="space-y-3">
      <div>
        <FieldLabel>Product name</FieldLabel>
        <TextInput className="mt-1" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <FieldLabel>Recipe — components per 1 piece</FieldLabel>
      {components.length === 0 && <p className="text-sm text-amber-600">Add components first (Components tab).</p>}
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Select className="flex-1" value={r.componentId} onChange={e => setRow(i, { componentId: e.target.value })} options={compOptions} />
            <NumberInput className="w-24 text-center" value={r.qty} onChange={e => setRow(i, { qty: e.target.value })} />
            <button onClick={() => delRow(i)} className="w-10 h-10 rounded-xl bg-red-50 text-red-500 font-bold flex-shrink-0">✕</button>
          </div>
        ))}
      </div>
      <Button variant="neutral" className="w-full" onClick={addRow}>+ Add component to recipe</Button>
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
