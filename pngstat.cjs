const fs = require('fs')
const { PNG } = require('pngjs')

const file = process.argv[2] || 'shot.png'
const data = fs.readFileSync(file)
const png = PNG.sync.read(data)
const { data: px, width: w, height: h } = png

const BG = 0x0d0d0c
const TOL = 26 // ~10% per channel
let total = 0, bg = 0, bright = 0, colored = 0
const colorBuckets = {}

for (let i = 0; i < px.length; i += 4) {
  const r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3]
  const isBg = Math.abs(r - BG) < TOL && Math.abs(g - BG) < TOL && Math.abs(b - BG) < TOL
  const isBright = r > 40 || g > 40 || b > 40
  const isColored = Math.abs(r - g) > 12 || Math.abs(g - b) > 12 || Math.abs(r - b) > 12
  if (isBg) bg++
  if (isBright) bright++
  if (isColored) colored++
  total++
  // sample a bucket key
  const rk = Math.floor(r / 40), gk = Math.floor(g / 40), bk = Math.floor(b / 40)
  const key = `${rk},${gk},${bk}`
  colorBuckets[key] = (colorBuckets[key] || 0) + 1
}

const bgPct = (bg / total) * 100
const brightPct = (bright / total) * 100
const coloredPct = (colored / total) * 100

// top color buckets
const top = Object.entries(colorBuckets).sort((a, b) => b[1] - a[1]).slice(0, 10)
const hex = ([rk, gk, bk]) => ({
  r: rk * 40 + 20, g: gk * 40 + 20, b: bk * 40 + 20
})
console.log(`Dimensions: ${w}x${h}`)
console.log(`Total pixels: ${total}`)
console.log(`Background (near #0d0d0c) pixels: ${bg} (${bgPct.toFixed(1)}%)`)
console.log(`Bright pixels (r|g|b>40): ${bright} (${brightPct.toFixed(1)}%)`)
console.log(`Colored pixels: ${colored} (${coloredPct.toFixed(1)}%)`)
console.log('Top color buckets (bucket~rgb -> count):')
for (const [k, c] of top) {
  const rgb = hex(k.split(',').map(Number))
  const pct = (c / total) * 100
  console.log(`  #${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')} -> ${c} (${pct.toFixed(1)}%)  bucket ${k}`)
}
console.log('RESULT:', bgPct > 99.5 ? 'BLANK/BLACK - nothing rendered' : (brightPct > 1 ? 'CONTENT VISIBLE - model/environment rendered' : 'mostly black, uncertain'))
