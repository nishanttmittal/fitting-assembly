/**
 * Image helpers for product photos. A photo uploaded in admin is downscaled and
 * re-encoded as a compact JPEG data-URL so it stores cheaply in the product
 * record and syncs through Firestore (well under the 1 MB doc limit).
 */

/** First token of a product name is its catalogue code, e.g. "UTM-1". */
export const productCode = (name) => (name || '').trim().split(/\s+/)[0] || '?'

/**
 * Read an image File, scale so the longest side ≤ max px, return a JPEG
 * data-URL (~quality 0.8). Resolves to '' on failure.
 */
export function compressImage(file, max = 480) {
  return new Promise((resolve) => {
    if (!file) return resolve('')
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      try { resolve(canvas.toDataURL('image/jpeg', 0.8)) } catch { resolve('') }
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve('') }
    img.src = url
  })
}
