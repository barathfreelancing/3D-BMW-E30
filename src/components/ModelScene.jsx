import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, Html, MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
gsap.registerPlugin(ScrollTrigger)
import { anchoredBeats, e30Story } from '../data/e30Story'
import { OPENING_RIG, RIG_CHANNELS } from '../data/cameraStates'
import { runtime } from '../runtime'
import { useMobile } from '../hooks/useMobile'

/* ==========================================================================
   ASSETS
   This file is the ONLY place that configures GLTFLoader / KTX2 / Meshopt.

   ASSET PLACEMENT — the scene never swaps in an unrelated model. If the GLB is
   missing or unreadable the studio lighting, camera rig and every scroll beat
   keep working and a proportioned wireframe stand-in is drawn in its place,
   with a note on screen naming the file that is expected:

     public/models/BMW-E30-M3-optimized.glb

   public/models/README.md documents the export settings the loader assumes.
   ========================================================================== */

const BASE = import.meta.env.BASE_URL
export const MODEL_URL = `${BASE}models/BMW-E30-M3-optimized.glb`
export const MODEL_PATH = 'public/models/BMW-E30-M3-optimized.glb'
const BASIS_PATH = `${BASE}basis/` // populated by scripts/copy-basis.mjs
const MODEL_BYTES = 19_249_736 // fallback when the server sends no Content-Length

/* ==========================================================================
   GEOMETRY REFERENCE (verified against the GLB, metres, scene space)
   The loader re-centres the car: footprint centre at the origin, ground y = 0,
   nose toward +Z.
     nose +2.18 · tail -2.18 · roof +1.35 · width ±0.96
     headlights z +1.95 y 0.60 · front wheel x ±0.70 y 0.31 z +1.35
     rear wheel  x ±0.71 y 0.31 z -1.24
   Authored framings live in src/data/e30Story.js and are projected into
   desktop/mobile rigs by src/data/cameraStates.js.
   ========================================================================== */

/* ==========================================================================
   LOAD PROGRESS: tiny external store so only the overlay re-renders
   ========================================================================== */

let progressValue = 0
let phaseValue = 'REQUESTING MODEL'
const progressListeners = new Set()

const PHASE_AT = [
  [0, 'REQUESTING MODEL'],
  [1, 'DECODING MESHOPT'],
  [55, 'TRANSCODING TEXTURES'],
  [92, 'COMPILING SHADERS'],
]

const setProgress = (v) => {
  const pct = Math.max(0, Math.min(100, v))
  let phase = PHASE_AT[0][1]
  for (const [at, name] of PHASE_AT) if (pct >= at) phase = name
  if (phase !== phaseValue) {
    phaseValue = phase
    progressListeners.forEach((fn) => fn())
  }
  const next = Math.max(progressValue, Math.round(pct))
  if (next === progressValue) return
  progressValue = next
  progressListeners.forEach((fn) => fn())
}

// Load status is separate from progress: 100% only means the bytes arrived.
// 'ready' means the model has been drawn at least once; 'error' carries why not.
let statusValue = 'loading'
let errorValue = null

const setLoadStatus = (status, error = null) => {
  // A late success always wins over a timeout, so a slow load is never stuck.
  if (statusValue === 'ready') return
  statusValue = status
  errorValue = error
  progressListeners.forEach((fn) => fn())
}

const subscribeProgress = (fn) => {
  progressListeners.add(fn)
  return () => progressListeners.delete(fn)
}
const getProgress = () => progressValue
const getPhase = () => phaseValue
const getStatus = () => statusValue
const getError = () => errorValue

const LOAD_TIMEOUT_MS = 60_000
// Upper bound on waiting for the parallel shader compile before mounting.
const PRECOMPILE_CAP_MS = 20_000

const log = import.meta.env.DEV ? (...args) => console.log('[E30]', ...args) : () => {}

/* ==========================================================================
   LOADER CONFIGURATION
   ========================================================================== */

let ktx2Loader = null

function getKTX2Loader(gl) {
  if (!ktx2Loader) {
    ktx2Loader = new KTX2Loader()
    ktx2Loader.setTranscoderPath(BASIS_PATH)
  }
  // Must run before the GLB parses: picks the GPU texture format to transcode
  // to (ASTC / BC7 / ETC2 ...). Safe to call repeatedly.
  ktx2Loader.detectSupport(gl)
  return ktx2Loader
}

// r3f invokes this on the shared GLTFLoader BEFORE .load(), every time.
// It is idempotent by design.
const configureLoader = (gl) => (loader) => {
  loader.setKTX2Loader(getKTX2Loader(gl))
  loader.setMeshoptDecoder(MeshoptDecoder)
}

const onModelProgress = (e) => {
  const total = e.total || MODEL_BYTES
  // Hold at 99 until the parse + transcode finishes and the scene is ready.
  setProgress(Math.min(99, (e.loaded / total) * 100))
}

/* ==========================================================================
   PAINT
   The GLB ships the body as a fully METALLIC red (metalness 1, roughness
   0.5). A metal has no diffuse term: it can only show what it reflects, and a
   dark studio reflects almost nothing, so the car went flat and near-black
   between highlights. Real E30 solid red is a pigmented dielectric base under
   a glossy clear coat, which is what this restores: the base takes the key
   light as colour (depth), the clear coat carries the sharp softbox strips
   (shape). The hue is pulled a touch deeper so the highlights read as red,
   not orange-pink, after tone mapping.
   ========================================================================== */

const PAINT_MATERIAL = 'BMW_E30_M3_PAINT'

function tunePaint(m) {
  m.color.set('#a3121a')
  m.metalness = 0.32
  m.roughness = 0.24
  if (m.isMeshPhysicalMaterial) {
    // a freshly detailed clear coat: near-mirror top layer, so the studio
    // strips land on the body as crisp lines instead of soft smears
    m.clearcoat = 1
    m.clearcoatRoughness = 0.012
  }
  m.envMapIntensity = 1.9
  m.needsUpdate = true
}

/* ==========================================================================
   DETAIL FINISH
   The GLB's trim materials are tuned for a neutral viewer. In the studio
   they read flat, so each gets the finish it would have on a show car:
   polished chrome, glossy black trim, wet glass, satin wheels. Multipliers
   on roughness keep any packed roughness maps intact.
   ========================================================================== */

/** Front-only part: the four round headlamp bowls (not the lens, which also
 *  covers the indicators and tail lamps). */
const HEADLAMP_MATERIAL = 'BMW_E30_M3_HEADLIGHT_REFLECTOR'

const DETAIL_FINISH = {
  BMW_E30_M3_CHROME: { roughness: 0.05, envMapIntensity: 2.2 },
  BMW_E30_M3_SIDE_MIRROR: { roughness: 0.08, envMapIntensity: 1.8 },
  BMW_E30_M3_HEADLIGHT_REFLECTOR: { roughness: 0.06, envMapIntensity: 2.2 },
  BMW_E30_M3_TAILLIGHT_REFLECTOR: { roughness: 0.05, envMapIntensity: 1.8 },
  BMW_E30_M3_EMBLEMS: { roughness: 0.08, envMapIntensity: 1.8 },
  BMW_E30_M3_LENS: { roughness: 0.04, envMapIntensity: 1.8, clearcoatRoughness: 0.02 },
  BMW_E30_M3_PLASTIC: { roughness: 0.16, envMapIntensity: 1.5 },
  BMW_E30_M3_WINDOWS: { roughness: 0.02, envMapIntensity: 2.0 },
  BMW_E30_M3_RIM: { roughness: 0.5, envMapIntensity: 1.6, clearcoatRoughness: 0.05 },
  Brembo_Calipers: { roughness: 0.6, envMapIntensity: 1.4, clearcoatRoughness: 0.08 },
  BMW_E30_M3_TIRE: { roughness: 0.92, envMapIntensity: 0.7 },
}

function tuneDetail(m) {
  const f = DETAIL_FINISH[m.name]
  if (!f) return
  // A roughness map multiplies m.roughness, so the value acts as a scale.
  if (f.roughness !== undefined) m.roughness = Math.min(m.roughness, f.roughness)
  if (f.envMapIntensity !== undefined) m.envMapIntensity = f.envMapIntensity
  if (m.isMeshPhysicalMaterial && f.clearcoatRoughness !== undefined) m.clearcoatRoughness = f.clearcoatRoughness
  m.needsUpdate = true
}

/* ==========================================================================
   MODEL
   ========================================================================== */

function E30Model({ onLoaded, groupRef }) {
  const gl = useThree((s) => s.gl)
  const rootScene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  const gltf = useLoader(GLTFLoader, MODEL_URL, configureLoader(gl), onModelProgress)

  // Prepare once. No cloning: the loaded scene is mounted directly.
  const { scene, offset } = useMemo(() => {
    const s = gltf.scene
    s.updateMatrixWorld(true)

    let meshCount = 0
    s.traverse((obj) => {
      if (obj.isMesh) meshCount++
    })
    log('GLB loaded — children:', s.children.length, 'meshes:', meshCount)
    // Caught by ModelBoundary, which reports it on the loader.
    if (meshCount === 0) throw new Error(`${MODEL_PATH} parsed but contains no meshes`)

    // Centre the footprint and drop the car onto y = 0.
    const box = new THREE.Box3().setFromObject(s)
    const center = box.getCenter(new THREE.Vector3())

    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy())
    s.traverse((o) => {
      if (!o.isMesh) return
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of mats) {
        // KHR_materials_transmission forces an extra full-scene render pass.
        // Fall back to plain alpha blending for any material using it.
        if (m.transmission > 0) {
          m.transmission = 0
          m.transparent = true
          m.opacity = Math.min(m.opacity, 0.4)
          m.depthWrite = false
        }
        for (const key in m) {
          const v = m[key]
          if (v && v.isTexture) v.anisotropy = aniso
        }
        if (m.name === PAINT_MATERIAL) tunePaint(m)
        else tuneDetail(m)
        if (m.name === HEADLAMP_MATERIAL) {
          // The lamp bowls glow from inside the lens; RigDriver drives the
          // intensity from the `lamps` channel. Emissive is always part of a
          // standard material, so this never recompiles a shader.
          m.emissive.set('#fff1dc')
          m.emissiveIntensity = 0
          runtime.headlampMaterial = m
        }
      }
    })

    // Ensure everything is visible
    s.visible = true
    s.traverse((obj) => {
      if (obj.isMesh) obj.visible = true
    })

    return { scene: s, offset: [-center.x, -box.min.y, -center.z] }
  }, [gltf, gl])

  groupRef.current = { scene, offset }

  useEffect(() => log('model component mounted'), [])

  // SHADERS. Drawing the car for the first time compiles ~11 programs. Done
  // synchronously inside a frame, ANGLE/D3D11 on integrated GPUs can stall
  // the GPU process for 40 s or more: no frame presents, rAF stops, and the
  // page sits on "COMPILING SHADERS". So the car's programs are compiled
  // with compileAsync (KHR_parallel_shader_compile) BEFORE it is added to
  // the drawn scene; frames keep presenting meanwhile, and the first real
  // draw hits warm programs. It starts on the first frame after the GLB
  // resolves, once the Environment has set scene.environment, so the
  // programs carry the same defines the real draw will ask for.
  const [compiled, setCompiled] = useState(false)
  const compileStarted = useRef(false)
  const frames = useRef(0)
  useFrame(() => {
    if (!compileStarted.current) {
      compileStarted.current = true
      const t0 = performance.now()
      log('precompiling shaders…')
      const cap = new Promise((r) => setTimeout(r, PRECOMPILE_CAP_MS, 'cap'))
      Promise.race([gl.compileAsync(scene, camera, rootScene), cap]).then(
        (r) => {
          log(r === 'cap' ? 'precompile still running — mounting anyway' : `shaders compiled in ${Math.round(performance.now() - t0)} ms`)
          setCompiled(true)
        },
        (err) => {
          console.warn('[E30] shader precompile failed, mounting anyway:', err)
          setCompiled(true)
        },
      )
      return
    }
    // Ready = the model has actually been drawn: frame 1 after mount renders
    // it, frame 2 proves that render finished.
    if (!compiled || frames.current > 1) return
    if (++frames.current === 2) {
      log('first frame with model rendered — ready')
      onLoaded()
    }
  })

  return (
    <group
      position={offset}
      ref={(node) => {
        if (groupRef.current) groupRef.current.node = node
      }}
    >
      {compiled && <primitive object={scene} />}
      {compiled && <HeadlampGlow />}
    </group>
  )
}

/* ==========================================================================
   HEADLAMP GLOW
   The site has no bloom pass (on purpose), so a lit lamp is built from
   cheap parts, all additive and toneMapped off:
     · a soft halo per lamp (radial sprite)
     · one horizontal anamorphic streak per lamp pair — the cinematic flare
   Positions are measured from the GLB, in model space: lamp bowls at
   x ±0.42 / ±0.58, y 0.60, front face z ≈ 1.98. RigDriver sets opacity from
   the `lamps` channel times how squarely the camera faces the nose (lamps
   are directional: from the side or behind they fade out).
   ========================================================================== */

const LAMPS = [-0.58, -0.42, 0.42, 0.58].map((x) => [x, 0.602, 2.02])
const STREAKS = [-0.5, 0.5].map((x) => [x, 0.602, 2.03])

function makeGlowTexture() {
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.12, 'rgba(255,255,255,0.85)')
  grad.addColorStop(0.32, 'rgba(255,255,255,0.22)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function HeadlampGlow() {
  const { halo, streak, texture } = useMemo(() => {
    const texture = makeGlowTexture()
    const common = {
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      opacity: 0,
    }
    return {
      texture,
      halo: new THREE.SpriteMaterial({ ...common, color: new THREE.Color('#fff2de') }),
      streak: new THREE.SpriteMaterial({ ...common, color: new THREE.Color('#cfe0ff') }),
    }
  }, [])

  useEffect(() => {
    runtime.headlampGlow = { halo, streak }
    return () => {
      runtime.headlampGlow = null
      halo.dispose()
      streak.dispose()
      texture.dispose()
    }
  }, [halo, streak, texture])

  return (
    <>
      {LAMPS.map((p) => (
        <sprite key={`h${p[0]}`} position={p} scale={[0.42, 0.42, 1]} material={halo} renderOrder={20} />
      ))}
      {STREAKS.map((p) => (
        <sprite key={`s${p[0]}`} position={p} scale={[2.6, 0.05, 1]} material={streak} renderOrder={21} />
      ))}
    </>
  )
}

/* ==========================================================================
   MODEL FALLBACK
   Used only when the GLB cannot be fetched or parsed. Deliberately a
   placeholder, never a substitute vehicle: a volume matching the E30 M3's
   measured envelope, drawn as a technical wireframe so the lighting rig, the
   camera choreography and every scroll beat keep working. It also registers
   itself with the rig, so it still turns with the story.
   ========================================================================== */

const FALLBACK_SIZE = [1.83, 1.28, 4.34] // w, h, l — from the measured envelope
const FALLBACK_CENTRE = [0, 0.66, 0]

function ModelFallback({ groupRef, error }) {
  const node = useRef(null)
  const boxGeo = useMemo(() => new THREE.BoxGeometry(...FALLBACK_SIZE), [])

  groupRef.current = { offset: [0, 0, 0] }

  return (
    <group ref={(n) => { if (n) { node.current = n; if (groupRef.current) groupRef.current.node = n } }} position={FALLBACK_CENTRE}>
      <mesh>
        <boxGeometry args={FALLBACK_SIZE} />
        <meshStandardMaterial color="#171512" transparent opacity={0.4} roughness={0.78} metalness={0.08} />
      </mesh>
      <lineSegments geometry={new THREE.EdgesGeometry(boxGeo)}>
        <lineBasicMaterial color="#8a7a63" transparent opacity={0.22} />
      </lineSegments>
      {error && (
        <Html position={[0, -1.5, 0]}>
          <div style={{
            color: '#c4451f',
            fontFamily: 'monospace',
            fontSize: '0.7rem',
            textAlign: 'center',
            maxWidth: '300px',
            whiteSpace: 'pre-wrap',
            padding: '10px',
            background: 'rgba(0,0,0,0.8)',
            borderRadius: '4px',
            border: '1px solid #c4451f'
          }}>
            MODEL LOAD ERROR
            <br/>
            {error.message || String(error)}
          </div>
        </Html>
      )}
    </group>
  )
}

/* ==========================================================================
   LIGHTING: procedural, no HDRI download — a dark automotive studio.
   Lightformers are baked into a cubemap once (frames={1}). They are what the
   clear coat REFLECTS, so their shapes are the car's highlights:
     · overhead softbox          roof, bonnet, boot lid
     · long side strips          the shoulder line and the sill, both sides
     · tall back strips          rim highlights on the tail and the C-pillar
     · front kicker              nose, grille, headlamp chrome
     · one low red strip         the only warm reflection
   Direct lights then shape the body (intensity driven by the rig per frame):
     KEY   neutral, high front-right: colour and form on the camera side
     RIM   cool, high behind: separates the roof and tail from the background
     KICK  cool, low behind-right: edges the rear arch and the bumper
     FILL  hemisphere, cool sky / dark red ground: lifts the shadow side and
           the wheels without flattening the body
     SPILL red, at floor level behind: restrained; rises with --energy
   No bloom, no emissive tricks — the depth comes from contrast.
   ========================================================================== */

function Lighting() {
  const key = useRef(null)
  const rim = useRef(null)
  const spill = useRef(null)
  const kick = useRef(null)
  const rim2 = useRef(null)
  const hemi = useRef(null)
  const beam = useRef(null)
  const bonnet = useRef(null)

  useEffect(() => {
    runtime.lights = {
      key: key.current,
      rim: rim.current,
      spill: spill.current,
      beam: beam.current,
      bonnet: bonnet.current,
      // studio lights with a fixed level: dimmed only by the prologue's dark
      fixed: [kick.current, rim2.current, hemi.current].map((light) => ({ light, base: light.intensity })),
    }
    // the beam's target sits far ahead of the nose, on the floor
    beam.current.target.position.set(0, 0, 10)
    beam.current.target.updateMatrixWorld()
    bonnet.current.target.position.set(0, 0.85, 1.25)
    bonnet.current.target.updateMatrixWorld()
    return () => {
      runtime.lights = null
    }
  }, [])

  return (
    <>
      <Environment resolution={512} frames={1} environmentIntensity={0.9}>
        {/* overhead softbox: roof, bonnet, boot lid */}
        <Lightformer form="rect" intensity={2.6} color="#eef2f7" position={[0, 6, 0]} scale={[9, 4, 1]} />
        {/* a hard, narrow strip overhead: the crisp line along roof and bonnet */}
        <Lightformer form="rect" intensity={7} color="#ffffff" position={[0, 5.5, 0.5]} scale={[0.35, 8, 1]} />
        {/* long strips on both sides at shoulder height: the shoulder line */}
        <Lightformer form="rect" intensity={9} color="#f6f8fb" position={[7, 1.15, 0]} scale={[12, 0.26, 1]} />
        <Lightformer form="rect" intensity={6.5} color="#f6f8fb" position={[-7, 1.15, 0]} scale={[12, 0.26, 1]} />
        {/* a lower, weaker strip: the sill and the lower door crease */}
        <Lightformer form="rect" intensity={3} color="#e4eaf2" position={[7, 0.35, 0]} scale={[10, 0.14, 1]} />
        {/* tall strips behind: rim highlights on the tail and pillars */}
        <Lightformer form="rect" intensity={5} color="#e2eaf5" position={[-5, 2.2, -6]} scale={[0.45, 5, 1]} />
        <Lightformer form="rect" intensity={3.8} color="#e2eaf5" position={[5, 2.2, -6]} scale={[0.45, 5, 1]} />
        {/* front kicker: nose, grille, lamp chrome */}
        <Lightformer form="rect" intensity={1.3} color="#f4f4f2" position={[0, 1.6, 8]} scale={[7, 1.0, 1]} />
        {/* the only warm reflection: a low red strip behind-left */}
        <Lightformer form="rect" intensity={1.4} color="#b8231b" position={[-5, 0.35, -6]} scale={[6, 0.2, 1]} />
      </Environment>

      <directionalLight ref={key} position={[5, 7, 4]} intensity={0.9} color="#f6f2ec" />
      <directionalLight ref={rim} position={[-5, 3.4, -6.5]} intensity={1.2} color="#d8e3f4" />
      <directionalLight ref={kick} position={[6, 1.1, -5]} intensity={0.7} color="#cfdcef" />
      {/* second rim, high behind-right: the roofline and spoiler edge */}
      <directionalLight ref={rim2} position={[3.5, 4.5, -6]} intensity={0.8} color="#dbe5f4" />
      <hemisphereLight ref={hemi} args={['#2c3644', '#1c0907', 0.22]} />
      {/* the headlamps' throw onto the floor: always in the scene (a light
          added later would recompile every lit shader), lit only in the
          prologue. In world space — the car faces +Z, unrotated, there. */}
      <spotLight
        ref={beam}
        position={[0, 0.62, 2.1]}
        angle={0.48}
        penumbra={0.9}
        distance={14}
        decay={1.8}
        intensity={0}
        color="#fff1dc"
      />
      {/* the prologue's only other light: a narrow top light that picks a
          sliver of bonnet out of the dark. Same always-present rule. */}
      <spotLight
        ref={bonnet}
        position={[0, 3.3, 3.4]}
        angle={0.26}
        penumbra={1}
        distance={8}
        decay={1.6}
        intensity={0}
        color="#e9eef6"
      />
      <pointLight ref={spill} position={[-3.6, 0.45, -4.6]} intensity={0.6} color="#c3241b" distance={14} decay={2} />

      <ReflectiveFloor />
      <FloorMarks />
      {/* Baked once: the car never moves relative to the ground. */}
      <ContactShadows position={[0, 0.002, 0]} opacity={0.85} scale={9} blur={2.4} far={1.6} resolution={512} frames={1} color="#000000" />
    </>
  )
}

/* ==========================================================================
   STUDIO FLOOR — two layers.
   1. ReflectiveFloor: dark graphite with a real, blurred reflection of the
      car (drei MeshReflectorMaterial: one extra low-res render per frame,
      512 px, blurred, so it reads as polished concrete, not a mirror). Its
      alpha falls off radially through a generated alphaMap, so the floor
      dissolves into the CSS studio and never shows an edge — and the type
      layered behind the canvas (1986, 5,000, DTM) is only dimmed where the
      floor is actually in front of it.
   2. FloorMarks: a faint steel grid with heavier 5 m lines, two lane lines
      with quarter-metre ticks either side of the car, and a red spill whose
      strength follows the film's energy channel. Pure added light (premult-
      iplied, alpha 0), fading out with distance into the background.
   ========================================================================== */

const FLOOR_VERT = /* glsl */ `
  varying vec2 vXZ;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vXZ = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const FLOOR_FRAG = /* glsl */ `
  uniform float uSpill;
  uniform float uDim;
  varying vec2 vXZ;

  float gridLine(vec2 p, float step, float width) {
    vec2 g = abs(fract(p / step - 0.5) - 0.5) * step / (fwidth(p) * width);
    return 1.0 - min(min(g.x, g.y), 1.0);
  }

  void main() {
    vec2 p = vXZ;
    float r = length(p * vec2(1.0, 0.8));

    float grid = gridLine(p, 1.0, 1.0) * 0.05 + gridLine(p, 5.0, 1.4) * 0.07;
    grid *= smoothstep(1.4, 3.2, r);                                     // clear under the car

    // lane lines at x = ±1.55 with 0.25 m ticks, only alongside the car
    float lane = 0.0;
    float along = 1.0 - smoothstep(3.2, 5.0, abs(p.y));
    for (int i = 0; i < 2; i++) {
      float x = i == 0 ? 1.55 : -1.55;
      float d = abs(p.x - x) / fwidth(p.x);
      lane += (1.0 - min(d, 1.0)) * 0.09;
      float tick = abs(fract(p.y * 4.0 - 0.5) - 0.5) / (fwidth(p.y) * 4.0);
      float inTick = step(abs(p.x - x), 0.07) * step(0.0, (p.x - x) * sign(x));
      lane += (1.0 - min(tick, 1.0)) * inTick * 0.06;
    }

    // red spill off the paint, strongest just behind the car
    float spill = exp(-(p.x * p.x / 5.0 + (p.y + 1.2) * (p.y + 1.2) / 10.0));
    spill *= 0.05 + uSpill * 0.1;

    // the grid thins out with distance and is gone well before the floor is
    float fade = 1.0 - smoothstep(3.5, 11.0, r);
    vec3 steel = vec3(0.62, 0.70, 0.80);
    vec3 col = steel * (grid + lane * along) * fade + vec3(0.6, 0.05, 0.03) * spill * fade;
    // premultiplied with alpha 0: pure added light
    gl_FragColor = vec4(col * uDim, 0.0);
  }
`

function FloorMarks() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: FLOOR_VERT,
        fragmentShader: FLOOR_FRAG,
        uniforms: { uSpill: { value: 0 }, uDim: { value: 0 } },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        // premultiplied "over" with alpha 0: the marks only add light
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      }),
    [],
  )

  useEffect(() => {
    runtime.floor = material
    return () => {
      runtime.floor = null
      material.dispose()
    }
  }, [material])

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]} renderOrder={-1} material={material}>
      <planeGeometry args={[40, 40]} />
    </mesh>
  )
}

// Floor opacity. While giant type set BEHIND the car (1986, 5,000, DTM,
// M3) is on screen the floor thins out, so that type is not cut in two
// where the floor crosses it; RigDriver damps between the two values.
const FLOOR_OPACITY = 0.92
const FLOOR_OPACITY_BEHIND_TYPE = 0.16

/** Keeps runtime.backTypeOnScreen true while any behind-the-car type is visible. */
function useBackTypeVisibility() {
  useEffect(() => {
    const targets = document.querySelectorAll('.beat__back > *, .beat__year')
    if (!targets.length || !('IntersectionObserver' in window)) return
    const visible = new Set()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.intersectionRatio > 0.2) visible.add(e.target)
          else visible.delete(e.target)
        }
        runtime.backTypeOnScreen = visible.size > 0
      },
      { threshold: [0, 0.2, 0.5] },
    )
    targets.forEach((t) => io.observe(t))
    return () => {
      io.disconnect()
      runtime.backTypeOnScreen = false
    }
  }, [])
}

/** Radial alpha: opaque around the car, gone by ~12 m. Green channel = alpha. */
function makeFloorAlpha() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, '#fff')
  g.addColorStop(0.2, '#fff')
  g.addColorStop(0.42, '#6a6a6a')
  g.addColorStop(0.62, '#000')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  return tex
}

function ReflectiveFloor() {
  const mobile = useMobile()
  useBackTypeVisibility()
  const alphaMap = useMemo(makeFloorAlpha, [])
  useEffect(() => () => alphaMap.dispose(), [alphaMap])

  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[0, -0.002, 0]}
      renderOrder={-2}
      ref={(mesh) => {
        // The mesh, not the material: drei recreates the material when its
        // defines change, so it is read fresh from the mesh every frame.
        runtime.reflector = mesh
      }}
    >
      <planeGeometry args={[40, 40]} />
      <MeshReflectorMaterial
        resolution={mobile ? 256 : 512}
        blur={[600, 200]}
        mixBlur={1}
        mixStrength={1.8}
        mixContrast={1.0}
        mirror={0.92}
        depthScale={1.1}
        minDepthThreshold={0.35}
        maxDepthThreshold={1.3}
        color="#3b4149"
        roughness={0.9}
        metalness={0.2}
        // Keeps the studio softboxes from washing the floor grey at grazing
        // camera angles; the car's own reflection carries the sheen.
        envMapIntensity={0.22}
        transparent
        depthWrite={false}
        alphaMap={alphaMap}
        opacity={FLOOR_OPACITY}
      />
    </mesh>
  )
}

/* ==========================================================================
   RIG DRIVER — the only per-frame work in the scene (E30Model's useFrame
   exits after the second frame).
   Scroll -> useStoryTimeline writes runtime.target.
   Here: damp toward it, then push camera / model / lights / DOM together so
   they can never disagree by a frame.
   ========================================================================== */

const tmpTarget = new THREE.Vector3()
const tmpPos = new THREE.Vector3()
const tmpVec = new THREE.Vector3()
const lampFwd = new THREE.Vector3()
const lampPos = new THREE.Vector3()
const lampToCam = new THREE.Vector3()

const damp = THREE.MathUtils.damp

// The story data authors key/rim on a 0..2 scale; these map it onto the
// studio rig (the rim is now a cool edge light, not the old red point).
const KEY_GAIN = 1.25
const RIM_GAIN = 1.85
const ENV_GAIN = 1.25

function RigDriver({ groupRef, reducedMotion, introRef, mobile }) {
  const rig = useRef({ ...OPENING_RIG })
  const parallax = useRef({ x: 0, y: 0, tx: 0, ty: 0 })
  const applied = useRef({ fov: NaN, sx: NaN, sy: NaN, w: 0, h: 0 })
  const lastDom = useRef({ veil: -1, energy: -1, final: -1, dark: -1 })
  const frameCount = useRef(0)

  // Subtle pointer parallax (fine pointers only, off under reduced motion).
  useEffect(() => {
    if (reducedMotion) return
    const p = parallax.current
    const onMove = (e) => {
      if (e.pointerType === 'touch') return
      p.tx = (e.clientX / window.innerWidth) * 2 - 1
      p.ty = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [reducedMotion])

  useFrame((state, delta) => {
    if (frameCount.current++ === 0) log('first R3F frame')
    const target = runtime.target
    const { camera, size, gl, scene } = state
    const r = rig.current
    const p = parallax.current
    const a = applied.current
    const aspect = size.width / size.height
    const dt = Math.min(delta, 1 / 20)

    // Under reduced motion the rig changes in steps (see useStoryTimeline);
    // a slow damp turns those steps into a short cross-fade instead of a cut,
    // which is the least camera movement that still keeps the story legible.
    const lambda = reducedMotion ? 2.4 : 11

    if (target) {
      for (let i = 0; i < RIG_CHANNELS.length; i++) {
        const k = RIG_CHANNELS[i]
        const to = target[k]
        if (!Number.isFinite(to)) continue
        // damp(NaN, x) is NaN forever: one bad value must not blank the scene
        // for the rest of the session, so snap instead.
        r[k] = Number.isFinite(r[k]) ? damp(r[k], to, lambda, dt) : to
      }
    }

    // Portrait screens: pull back and centre the car so the text column below
    // never fights it. narrow = 0 on landscape, 1 on tall phones.
    const narrow = mobile ? 1 : THREE.MathUtils.clamp((1.15 - aspect) / 0.65, 0, 1)
    // On phones the rig is already projected by toMobileRig (pulled back and
    // lifted), so only a small extra margin is added here; stacking the full
    // desktop fit on top of it left the car a speck at the top of the screen.
    // Very wide, short windows (e.g. 1366×630) shrink the car relative to
    // the page width, because the lens is vertical: dolly in a little so the
    // frame never looks empty. 1.6 (1440×900) is the authored aspect.
    const wide = mobile ? 1 : THREE.MathUtils.clamp(Math.sqrt(1.6 / aspect), 0.84, 1)
    const fit = (1 + narrow * (mobile ? 0.3 : 0.85)) * wide
    const sx = r.sx * (1 - narrow)
    const sy = r.sy + narrow * (mobile ? 0 : 0.14)

    // Entry dolly: a single orchestrated move as the model is revealed.
    const dolly = fit * (1 + (1 - introRef.current.v) * 0.14)

    p.x = damp(p.x, p.tx * 0.22, 2.5, dt)
    p.y = damp(p.y, p.ty * 0.12, 2.5, dt)

    tmpTarget.set(r.tx, r.ty, r.tz)
    tmpPos.set(r.px, r.py, r.pz).sub(tmpTarget).multiplyScalar(dolly).add(tmpTarget)
    camera.position.copy(tmpPos)
    camera.lookAt(tmpTarget)
    camera.translateX(p.x)
    camera.translateY(p.y)

    // Projection only changes when fov, shift or viewport change.
    const eps = 1e-4
    if (
      Math.abs(a.fov - r.fov) > eps || Math.abs(a.sx - sx) > eps || Math.abs(a.sy - sy) > eps ||
      a.w !== size.width || a.h !== size.height
    ) {
      camera.fov = r.fov
      if (sx || sy) {
        // +x shifts the image right, +y shifts it up.
        camera.setViewOffset(size.width, size.height, -sx * size.width, sy * size.height, size.width, size.height)
      } else {
        camera.clearViewOffset()
      }
      camera.updateProjectionMatrix()
      a.fov = r.fov; a.sx = sx; a.sy = sy; a.w = size.width; a.h = size.height
    }

    /* ---- model transform ------------------------------------------------ */
    const group = groupRef.current
    const node = group?.node
    if (node && group) {
      const o = group.offset
      node.rotation.set(r.rx, r.ry, r.rz)
      node.position.set(o[0] + r.mx, o[1] + r.my, o[2] + r.mz)
      node.scale.setScalar(r.ms)
    }

    /* ---- lighting + grade ---------------------------------------------- */
    scene.environmentIntensity = r.env * ENV_GAIN
    gl.toneMappingExposure = r.exp
    const lights = runtime.lights
    if (lights?.key) lights.key.intensity = r.key * KEY_GAIN
    if (lights?.rim) lights.rim.intensity = r.rim * RIM_GAIN
    const lit = 1 - r.dark
    if (lights?.spill) lights.spill.intensity = (0.35 + r.energy * 2.4) * lit
    if (lights?.fixed) for (const f of lights.fixed) f.light.intensity = f.base * lit
    if (runtime.floor) {
      runtime.floor.uniforms.uSpill.value = r.energy
      runtime.floor.uniforms.uDim.value = lit
    }

    /* ---- headlamps ------------------------------------------------------
       `lamps` from the rig; a short sputter while they ignite (time-based,
       so it reads as a cold start, never under reduced motion). Halos fade
       with how squarely the camera faces the nose.                        */
    let lamp = r.lamps
    if (lamp > 0.02 && lamp < 0.45 && !reducedMotion) {
      const t = state.clock.elapsedTime
      if (Math.sin(t * 31) * Math.sin(t * 7.3) > 0.3) lamp *= 0.2
    }
    if (runtime.headlampMaterial) runtime.headlampMaterial.emissiveIntensity = lamp * 5
    const glow = runtime.headlampGlow
    if (glow && node) {
      lampFwd.set(0, 0, 1).applyQuaternion(node.quaternion)
      lampPos.set(0, 0.6, 2).applyMatrix4(node.matrixWorld)
      lampToCam.copy(camera.position).sub(lampPos).normalize()
      const facing = Math.max(0, lampFwd.dot(lampToCam))
      const front = facing * facing * facing
      glow.halo.opacity = lamp * front
      glow.streak.opacity = lamp * front * 0.5
    }
    if (lights?.beam) lights.beam.intensity = lamp * 20 * r.dark
    // the bonnet light follows the lamps in, but only once they are steady
    if (lights?.bonnet) lights.bonnet.intensity = Math.max(0, r.lamps - 0.6) * 2.5 * 9 * r.dark
    const reflector = runtime.reflector?.material
    if (reflector) {
      const to = runtime.backTypeOnScreen ? FLOOR_OPACITY_BEHIND_TYPE : FLOOR_OPACITY
      reflector.opacity = damp(reflector.opacity, to, 4, dt)
    }

    /* ---- DOM atmosphere -------------------------------------------------
       Written only when a value has actually moved, and always as a custom
       property on the root element, so the compositor handles it, not
       layout.        */
    const dom = lastDom.current
    if (Math.abs(dom.veil - r.veil) > 0.004) {
      dom.veil = r.veil
      document.documentElement.style.setProperty('--veil', r.veil.toFixed(3))
    }
    // final veil only activates in the last beat (veil >= 0.8)
    const final = r.veil > 0.78 ? (r.veil - 0.78) / 0.22 : 0
    if (Math.abs(dom.final - final) > 0.004) {
      dom.final = final
      document.documentElement.style.setProperty('--final', final.toFixed(3))
    }
    if (Math.abs(dom.dark - r.dark) > 0.004) {
      dom.dark = r.dark
      document.documentElement.style.setProperty('--dark', r.dark.toFixed(3))
    }
    if (Math.abs(dom.energy - r.energy) > 0.004) {
      dom.energy = r.energy
      document.documentElement.style.setProperty('--energy', r.energy.toFixed(3))
    }

    /* ---- projected callout anchors --------------------------------------
       World point -> screen px, straight into runtime.points for the DOM
       callout layer. One project() per anchored beat per frame.            */
    for (let i = 0; i < anchoredBeats.length; i++) {
      const beat = anchoredBeats[i]
      const point = runtime.points[beat.id]
      if (!point) continue
      tmpVec.set(beat.anchor[0], beat.anchor[1], beat.anchor[2]).project(camera)
      point.x = (tmpVec.x * 0.5 + 0.5) * size.width
      point.y = (-tmpVec.y * 0.5 + 0.5) * size.height
      point.on = tmpVec.z <= 1
    }
  })

  return null
}

/* ==========================================================================
   ERROR BOUNDARIES: if WebGL or the model fails, the page stays readable.
   ========================================================================== */

class SceneBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error) {
    console.error('[ModelScene] 3D scene failed:', error)
    this.props.onFail?.(error)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** Scoped so a missing or broken GLB degrades to the wireframe, not the page. */
class ModelBoundary extends Component {
  state = { failed: false, error: null }
  static getDerivedStateFromError(error) {
    return { failed: true, error }
  }
  componentDidCatch(error) {
    console.error('[ModelScene] model failed to load:', error)
    this.props.onFail?.(error)
  }
  render() {
    return this.state.failed
      ? <ModelFallback groupRef={this.props.groupRef} error={this.state.error} />
      : this.props.children
  }
}

/* ==========================================================================
   PUBLIC COMPONENTS
   ========================================================================== */

export default function ModelScene({ reducedMotion, onReady }) {
  const containerRef = useRef(null)
  const groupRef = useRef(null)
  const introRef = useRef({ v: reducedMotion ? 1 : 0 })
  const mobile = useMobile()
  const [failed, setFailed] = useState(false)
  const [modelError, setModelError] = useState(null)

  // In both handlers the load status and onReady go FIRST. Everything after is
  // presentation; if it throws, the loader must still have been released.
  const handleFailed = useMemoCallback((error) => {
    if (runtime.modelFailed || runtime.modelReady) return
    runtime.modelFailed = true
    const err = error instanceof Error ? error : new Error(String(error ?? 'unknown error'))
    console.error('[E30] model load error:', err)
    setLoadStatus('error', err)
    setFailed(true)
    setModelError(err)
    introRef.current.v = 1
    onReady?.()
    try {
      ScrollTrigger.refresh()
    } catch (e) {
      console.error('[E30] ScrollTrigger.refresh failed:', e)
    }
  })

  const handleLoaded = useMemoCallback(() => {
    if (runtime.modelReady) return
    runtime.modelReady = true
    setProgress(100)
    setLoadStatus('ready')
    onReady?.()
    try {
      containerRef.current?.classList.add('is-visible')
      if (reducedMotion) {
        introRef.current.v = 1
      } else {
        gsap.to(introRef.current, { v: 1, duration: 2.6, ease: 'power3.out' })
      }
      // Layout is final now; make sure every ScrollTrigger measured it.
      ScrollTrigger.refresh()
    } catch (e) {
      introRef.current.v = 1
      console.error('[E30] post-load setup failed (model is still shown):', e)
    }
  })

  return (
    <div className="scene" role="img" aria-label={e30Story.meta.canvasAlt} ref={containerRef}>
      <SceneBoundary onFail={handleFailed}>
        <Canvas
          frameloop="always"
          dpr={[1, mobile ? 1.5 : 1.75]}
          camera={{
            fov: OPENING_RIG.fov,
            near: 0.1,
            far: 100,
            position: [OPENING_RIG.px, OPENING_RIG.py, OPENING_RIG.pz],
          }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          performance={{ min: 0.6 }}
          onCreated={({ gl, scene, camera }) => {
            log('canvas created')
            // Neutral (Khronos PBR Neutral) keeps saturated reds red at the
            // top of the curve, where ACES shifts them toward orange-pink.
            gl.toneMapping = THREE.NeutralToneMapping
            gl.toneMappingExposure = OPENING_RIG.exp
            // A GPU reset (e.g. a driver timeout during the first shader
            // compile) stops all frames; report it rather than wait silently.
            gl.domElement.addEventListener('webglcontextlost', () => {
              setLoadStatus('error', new Error('WebGL context lost (GPU reset or out of memory)'))
            })
            // Dev only: handles for inspecting the live scene from the console.
            if (import.meta.env.DEV) window.__e30 = { gl, scene, camera, THREE, runtime }
          }}
        >
          <RigDriver
            groupRef={groupRef}
            reducedMotion={reducedMotion}
            introRef={introRef}
            mobile={mobile}
          />
          <Suspense fallback={null}>
            <Lighting />
            <ModelBoundary onFail={handleFailed} groupRef={groupRef}>
              <E30Model onLoaded={handleLoaded} groupRef={groupRef} />
            </ModelBoundary>
          </Suspense>
        </Canvas>
      </SceneBoundary>
      {failed && (
        <p className="scene__notice t-mono" role="status">
          <span className="scene__notice-key">ASSET PLACEHOLDER</span>
          <span>Expected {MODEL_PATH} — a technical stand-in is shown in its place.</span>
          {modelError && (
            <span className="scene__notice-error" style={{color: '#c4451f', marginTop: '8px', display: 'block', fontSize: '0.7rem'}}>
              Error: {modelError.message || String(modelError)}
            </span>
          )}
        </p>
      )}
    </div>
  )
}

// Keeps a stable identity across renders while always calling the latest closure,
// so the model's readiness effect never re-fires because of a new callback.
function useMemoCallback(fn) {
  const ref = useRef(fn)
  ref.current = fn
  return useRef((...args) => ref.current(...args)).current
}

/** Minimal loading state: wordmark, one status line, a hairline of progress. */
export function ModelLoadingOverlay({ onContinue }) {
  const pct = useSyncExternalStore(subscribeProgress, getProgress, getProgress)
  const phase = useSyncExternalStore(subscribeProgress, getPhase, getPhase)
  const status = useSyncExternalStore(subscribeProgress, getStatus, getStatus)
  const error = useSyncExternalStore(subscribeProgress, getError, getError)
  const [dismissed, setDismissed] = useState(false)
  const [gone, setGone] = useState(false)

  const ready = status === 'ready'
  const failed = status === 'error' && !dismissed

  // Never wait forever: report a timeout instead of sitting on a phase. Only
  // VISIBLE time counts — a hidden tab gets no animation frames at all, so a
  // load that pauses while the user is elsewhere must resume, not fail.
  useEffect(() => {
    if (status !== 'loading') return
    let visibleMs = 0
    const STEP = 500
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      visibleMs += STEP
      if (visibleMs < LOAD_TIMEOUT_MS) return
      clearInterval(t)
      setLoadStatus('error', new Error(
        `Timed out after ${LOAD_TIMEOUT_MS / 1000}s at "${getPhase()} ${getProgress()}%"`,
      ))
    }, STEP)
    return () => clearInterval(t)
  }, [status])

  // Fade (CSS) then unmount.
  useEffect(() => {
    if (!ready && !dismissed) return
    log('loader hidden')
    const t = setTimeout(() => setGone(true), 1100)
    return () => clearTimeout(t)
  }, [ready, dismissed])

  if (gone) return null

  const done = ready || dismissed

  return (
    <div className={`loader${done ? ' is-done' : ''}`} role={failed ? 'alert' : 'status'} aria-live="polite">
      <div className="loader__body">
        <p className="loader__mark t-display-md">{e30Story.meta.title}</p>
        {failed ? (
          <>
            <p className="t-mono loader__status">MODEL LOAD ERROR</p>
            {import.meta.env.DEV && error && (
              <p className="t-mono t-muted">{error.message || String(error)}</p>
            )}
            <p className="t-mono t-muted">Check browser console for details.</p>
            <p>
              <button
                type="button"
                className="t-mono loader__continue"
                onClick={() => {
                  setDismissed(true)
                  onContinue?.()
                }}
              >
                CONTINUE WITHOUT MODEL
              </button>
            </p>
          </>
        ) : (
          <p className="t-mono t-muted loader__status">
            {ready ? 'MODEL READY' : phase}
            <span aria-hidden="true" className="loader__pct">{String(pct).padStart(3, '0')}%</span>
          </p>
        )}
      </div>
      <span className="loader__line" aria-hidden="true">
        <span style={{ transform: `scaleX(${pct / 100})` }} />
      </span>
    </div>
  )
}
