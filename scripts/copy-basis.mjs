// Copies the Basis Universal transcoder (needed by KTX2Loader) from three.js
// into /public/basis so it is served from our own origin.
import { cp, mkdir } from 'node:fs/promises'
import path from 'node:path'

const src = path.resolve('node_modules/three/examples/jsm/libs/basis')
const dest = path.resolve('public/basis')

await mkdir(dest, { recursive: true })
for (const file of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
  await cp(path.join(src, file), path.join(dest, file))
}
console.log('[basis] transcoder copied to public/basis')
