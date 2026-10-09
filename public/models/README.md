# Model asset

The 3D hero of this project is loaded from exactly one place:

```
public/models/BMW-E30-M3-optimized.glb
```

At runtime this resolves to `/models/BMW-E30-M3-optimized.glb` (Vite serves
`public/` at the root and honours `import.meta.env.BASE_URL`; the URL constant
lives in `src/components/ModelScene.jsx` as `MODEL_URL`).

## If the file is missing

Nothing breaks and no substitute model is invented. `ModelScene.jsx` catches
the load failure with a scoped error boundary (`ModelBoundary`) and:

1. keeps the studio lighting, the camera rig, the projected callouts and every
   scroll beat running;
2. draws a proportioned **wireframe stand-in** matching the E30 M3's measured
   envelope (1.83 × 1.28 × 4.34 m) in the car's place;
3. shows a permanent on-screen note naming the file it expected.

To restore the real car, drop the GLB at the path above. No code change is
needed.

## Export settings the loader assumes

The pipeline is preserved from Milestone 1 and must not be removed:

| Setting | Value | Why |
| --- | --- | --- |
| Geometry compression | `EXT_meshopt_compression` | `MeshoptDecoder` is registered on the loader |
| Texture compression | `KHR_texture_basisu` (KTX2 / UASTC) | needs `KTX2Loader` + the transcoder in `public/basis/` |
| Quantization | `KHR_mesh_quantization` | baked into the meshopt pipeline |
| Draco | **not used** | no Draco decoder is wired up |

`public/basis/basis_transcoder.{js,wasm}` is copied out of `three` by
`scripts/copy-basis.mjs` on `postinstall`, `predev` and `prebuild`, and is
gitignored. Do not commit it.

## Coordinate reference used by the authored camera rigs

The loader re-centres the car so the footprint centre is the world origin, the
ground is `y = 0` and the nose points toward `+Z`. Verified against the
current file:

| Point | Scene space (metres) |
| --- | --- |
| Overall envelope | x ±0.96 · y 0.00 → 1.35 · z -2.18 → +2.18 |
| Headlights | z +1.95, y 0.60 |
| Front wheel centres | x ±0.70, y 0.31, z +1.35 |
| Rear wheel centres | x ±0.71, y 0.31, z -1.24 |
| Greenhouse | y 0.84 → 1.29 |

Every callout anchor in `src/data/e30Story.js` refers to this space. If the
model is replaced, re-check those numbers.

## Licence

The model in this repository is credited in the closing plate of the film
(`e30Story.meta.modelCredit`): CC-BY-4.0, Martin Trafas. Keep that attribution
if the asset is swapped.
