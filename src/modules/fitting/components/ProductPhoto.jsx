/**
 * ProductPhoto — shows a product's image. Priority:
 *   1. product.photo  (admin-uploaded data-URL)
 *   2. bundled crop at  ${BASE_URL}products/<code>.jpg
 *   3. fallback tile showing the product code
 * Used on the floor tiles and admin product list.
 */
import { useState, useEffect } from 'react'
import { productCode } from '../logic/image'

const BASE = import.meta.env.BASE_URL

export default function ProductPhoto({ product, className = '', rounded = 'rounded-xl' }) {
  const code = productCode(product?.name)
  const src = product?.photo || `${BASE}products/${code}.jpg`
  const [failed, setFailed] = useState(false)
  // Reset the error state if the source changes (e.g. a new photo uploaded).
  useEffect(() => { setFailed(false) }, [src])

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-slate-200 text-slate-500 font-bold text-center px-1 ${rounded} ${className}`}>
        <span className="text-xs leading-tight">{code}</span>
      </div>
    )
  }
  return (
    <img src={src} alt={product?.name || ''} onError={() => setFailed(true)}
      className={`object-contain bg-white ${rounded} ${className}`} />
  )
}
