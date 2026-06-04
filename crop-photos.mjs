/**
 * One-off: crop the 20 product photos out of the 6 UNICO catalogue pages on the
 * Desktop into public/products/<code>.jpg, and build a montage.png to verify.
 * Boxes are best-estimate; refine by inspecting montage.png. Admin can replace
 * any photo in-app later. Run: node crop-photos.mjs
 */
import { Jimp } from 'jimp'
import { mkdirSync } from 'fs'

const SRC = 'C:/Users/lenovo/Desktop'
const OUT = 'C:/Users/lenovo/Desktop/fitting-assembly/public/products'
mkdirSync(OUT, { recursive: true })

// { code, page, x, y, w, h } in source pixels.
const BOXES = [
  // page 1 (498x689) — tilting + push back
  { code: 'UTM-1',  page: 1, x: 45,  y: 72,  w: 185, h: 130 },
  { code: 'UTM-2',  page: 1, x: 250, y: 68,  w: 215, h: 95  },
  { code: 'UTM-3',  page: 1, x: 290, y: 208, w: 175, h: 44  },
  { code: 'UPM-1',  page: 1, x: 60,  y: 322, w: 175, h: 62  },
  { code: 'UPM-2',  page: 1, x: 282, y: 322, w: 182, h: 62  },
  { code: 'UPM-3',  page: 1, x: 60,  y: 388, w: 175, h: 75  },
  { code: 'UPM-4',  page: 1, x: 282, y: 388, w: 185, h: 75  },
  // page 2 (480x675) — sleek + synchro + torsion
  { code: 'USM-1',  page: 2, x: 55,  y: 52,  w: 175, h: 120 },
  { code: 'USM-2',  page: 2, x: 250, y: 52,  w: 185, h: 120 },
  { code: 'USSM-1', page: 2, x: 50,  y: 245, w: 185, h: 115 },
  { code: 'USSM-2', page: 2, x: 258, y: 245, w: 185, h: 115 },
  { code: 'UTRM-1', page: 2, x: 40,  y: 428, w: 240, h: 130 },
  // page 3 (452x158) — plates + fitting
  { code: 'USP-1',  page: 3, x: 10,  y: 5,   w: 140, h: 120 },
  { code: 'USP-2',  page: 3, x: 155, y: 5,   w: 145, h: 120 },
  { code: 'USP-3',  page: 3, x: 305, y: 5,   w: 140, h: 120 },
  // page 4 (213x447) — cross bars
  { code: 'UCAP-103A', page: 4, x: 25, y: 5,   w: 180, h: 165 },
  { code: 'UCAP-103B', page: 4, x: 25, y: 225, w: 180, h: 168 },
  // page 5 (247x217) — foot rests
  { code: 'UCAP-101', page: 5, x: 5,   y: 5, w: 115, h: 175 },
  { code: 'UCAP-102', page: 5, x: 125, y: 5, w: 118, h: 175 },
  // page 6 (195x145) — foot ring
  { code: 'UCAP-106', page: 6, x: 5, y: 0, w: 185, h: 115 },
]

const TILE = 300, PAD = 10
const pages = {}
const getPage = async (n) => (pages[n] ??= await Jimp.read(`${SRC}/${n}.png`))

const tiles = []
for (const b of BOXES) {
  const src = await getPage(b.page)
  const x = Math.max(0, Math.min(b.x, src.width - 2))
  const y = Math.max(0, Math.min(b.y, src.height - 2))
  const w = Math.min(b.w, src.width - x)
  const h = Math.min(b.h, src.height - y)
  const cropped = src.clone().crop({ x, y, w, h })
  cropped.scaleToFit({ w: TILE - PAD * 2, h: TILE - PAD * 2 })
  const tile = new Jimp({ width: TILE, height: TILE, color: 0xffffffff })
  tile.composite(cropped, (TILE - cropped.width) / 2, (TILE - cropped.height) / 2)
  await tile.write(`${OUT}/${b.code}.jpg`)
  tiles.push({ code: b.code, img: tile.clone().scaleToFit({ w: 150, h: 150 }) })
}

// montage: 4 cols
const COLS = 4, CELL = 150
const rows = Math.ceil(tiles.length / COLS)
const sheet = new Jimp({ width: COLS * CELL, height: rows * CELL, color: 0xeeeeeeff })
tiles.forEach((t, i) => {
  const cx = (i % COLS) * CELL + (CELL - t.img.width) / 2
  const cy = Math.floor(i / COLS) * CELL + (CELL - t.img.height) / 2
  sheet.composite(t.img, cx, cy)
})
await sheet.write('C:/Users/lenovo/Desktop/fitting-assembly/montage.png')

console.log('Wrote', tiles.length, 'tiles. Order (row-major, 4 cols):')
console.log(tiles.map(t => t.code).join(', '))
