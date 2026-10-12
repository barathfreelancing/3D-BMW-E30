// ===========================================================================
// RIG — the contract between the story and the 3D layer.
//
// One beat = one complete rig. `useStoryTimeline` lerps every one of these
// channels from the previous beat's rig into the current one as that beat's
// section scrolls past. `RigDriver` (inside the Canvas) reads the result once
// per frame. Nothing here touches React state.
//
// UNITS — metres, scene space, after the loader re-centres the car so the
// footprint centre is the origin and the ground is y = 0:
//   nose +2.18 · tail -2.18 · roof +1.35 · width ±0.96
//   front wheel x ±0.70 y 0.31 z +1.35 · rear wheel x ±0.71 y 0.31 z -1.24
// ===========================================================================

import { beats, chapterOrder } from './e30Story'

/** Every numeric channel the film can move. Order matters only for speed. */
export const RIG_CHANNELS = [
  // camera
  'px', 'py', 'pz', 'tx', 'ty', 'tz', 'fov', 'sx', 'sy',
  // model
  'rx', 'ry', 'rz', 'mx', 'my', 'mz', 'ms',
  // atmosphere
  'env', 'key', 'rim', 'exp', 'veil', 'energy',
  // prologue: headlamp power (0..1) and how much of the studio is blacked out
  'lamps', 'dark',
]

/** The frame the film starts on: the prologue's black void — a long lens,
 *  head-on and far away, every studio light off, headlamps off.
 *  Must match the `p-void` beat in e30Story.js. */
export const OPENING_RIG = {
  px: 0.4, py: 0.42, pz: 17,
  tx: 0, ty: 0.58, tz: 0.6,
  fov: 16, sx: 0, sy: 0,
  rx: 0, ry: 0, rz: 0,
  mx: 0, my: 0, mz: 0, ms: 1,
  env: 0, key: 0, rim: 0, exp: 1, veil: 0, energy: 0,
  lamps: 0, dark: 1,
}

/** Cheap mutable rig objects — allocated once, never in React state. */
export const makeRig = (base = OPENING_RIG) => {
  const r = {}
  for (const k of RIG_CHANNELS) r[k] = base[k] ?? 0
  return r
}

export const copyRig = (target, source) => {
  for (const k of RIG_CHANNELS) target[k] = source[k] ?? 0
  return target
}

/**
 * Every channel lerps linearly EXCEPT the camera position, which orbits:
 * radius, azimuth and elevation around the look-at target are interpolated
 * (azimuth the short way round). A straight line between two framings on
 * opposite sides of the car would drive the camera through the bodywork;
 * an orbit keeps it outside, and reads as one deliberate move.
 */
const TAU = Math.PI * 2
const toOrbit = (r, out) => {
  const dx = r.px - r.tx
  const dy = r.py - r.ty
  const dz = r.pz - r.tz
  out.radius = Math.hypot(dx, dy, dz) || 1e-6
  out.theta = Math.atan2(dx, dz)
  out.phi = Math.acos(Math.min(1, Math.max(-1, dy / out.radius)))
  return out
}
const oFrom = {}
const oTo = {}

export const lerpRig = (target, from, to, t) => {
  for (const k of RIG_CHANNELS) target[k] = from[k] + (to[k] - from[k]) * t
  toOrbit(from, oFrom)
  toOrbit(to, oTo)
  let dTheta = (oTo.theta - oFrom.theta) % TAU
  if (dTheta > Math.PI) dTheta -= TAU
  if (dTheta < -Math.PI) dTheta += TAU
  const radius = oFrom.radius + (oTo.radius - oFrom.radius) * t
  const theta = oFrom.theta + dTheta * t
  const phi = oFrom.phi + (oTo.phi - oFrom.phi) * t
  const s = Math.sin(phi)
  target.px = target.tx + radius * s * Math.sin(theta)
  target.py = target.ty + radius * Math.cos(phi)
  target.pz = target.tz + radius * s * Math.cos(theta)
  return target
}

/* ---------------------------------------------------------------------------
   EASING. GSAP eases are used for DOM work; the rig is lerped by hand inside
   a ScrollTrigger callback, so it needs plain functions.
   --------------------------------------------------------------------------- */

const pow = (n) => (t) => (t === 1 ? 1 : 1 - Math.pow(1 - t, n))
const inOut = (n) => (t) => (t < 0.5 ? Math.pow(2 * t, n) / 2 : 1 - Math.pow(-2 * t + 2, n) / 2)

export const EASES = {
  linear: (t) => t,
  'power1.inOut': inOut(2),
  'power2.inOut': inOut(3),
  'power3.inOut': inOut(4),
  'power4.out': pow(5),
  'expo.out': (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  'expo.inOut': (t) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  'back.out': (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
}

export const ease = (name, t) => (EASES[name] || EASES['power2.inOut'])(Math.min(1, Math.max(0, t)))

/* ---------------------------------------------------------------------------
   RESPONSIVE VARIANTS
   A portrait phone cannot hold a 17 mm-equivalent framing next to a column of
   text, so every desktop rig is projected into a mobile rig: pull back along
   the same view vector, widen slightly, drop the horizontal screen offset and
   lift the subject into the upper half so the text sits below it.
   Beats may override any channel with `mobile: { ... }`.
   --------------------------------------------------------------------------- */

const MOBILE = { pull: 1.62, lift: 0.28, fov: 6, sx: 0, sy: 0.2, spin: 0.45 }

export function toMobileRig(rig, override) {
  const out = makeRig(rig)
  const dx = rig.px - rig.tx
  const dy = rig.py - rig.ty
  const dz = rig.pz - rig.tz
  out.px = rig.tx + dx * MOBILE.pull
  out.py = rig.ty + dy * MOBILE.pull * 0.9 + MOBILE.lift
  out.pz = rig.tz + dz * MOBILE.pull
  out.fov = rig.fov + MOBILE.fov
  out.sx = MOBILE.sx
  out.sy = MOBILE.sy
  out.ry = rig.ry * MOBILE.spin
  if (override) for (const k in override) out[k] = override[k]
  return out
}

/* ---------------------------------------------------------------------------
   BEAT -> RIG
   A beat declares only what it changes; `carry` supplies the rest. This is
   what lets `origin.aftermath` move three numbers without restating the
   lighting rig of the previous beat.
   --------------------------------------------------------------------------- */

export function rigForBeat(beat, carry = OPENING_RIG, mobile = false) {
  const base = makeRig(carry)
  if (beat.cam) Object.assign(base, beat.cam)
  if (beat.model) Object.assign(base, beat.model)
  if (beat.light) Object.assign(base, beat.light)
  if (beat.veil !== undefined) base.veil = beat.veil
  // Screen offset fades out on tall screens regardless of the authored value.
  if (mobile) return toMobileRig(base, beat.mobile)
  // Desktop-only override (e.g. a tighter lens), the mirror of `mobile`.
  if (beat.desktop) Object.assign(base, beat.desktop)
  return base
}

/**
 * Dense, ordered descriptor the timeline walks: one entry per beat, each with
 * the rig it eases FROM (the previous beat's TO) and the rig it eases TO.
 * Built once per viewport class — it is pure data, so it is safe to memo.
 */
export function buildTimeline(mobile = false) {
  // The first beat eases FROM the opening rig, and at scroll 0 that is the
  // frame on screen — so on phones it must be the projected one too.
  let carry = mobile ? toMobileRig(OPENING_RIG) : OPENING_RIG
  return beats.map((beat) => {
    const to = rigForBeat(beat, carry, mobile)
    const entry = { id: beat.id, chapterId: beat.chapterId, from: carry, to, ease: beat.ease }
    carry = to
    return entry
  })
}

/**
 * Legacy per-chapter view. Kept because it is the clearest single-line answer
 * to "where is the camera in chapter N", and it is what a chapter-level
 * ScrollTrigger would have used. The film itself is beat-driven.
 */
export function buildChapterStates(mobile = false) {
  const out = {}
  let carry = OPENING_RIG
  for (const id of chapterOrder) {
    const first = beats.find((b) => b.chapterId === id)
    if (!first) continue
    const to = rigForBeat(first, carry, mobile)
    out[id] = to
    carry = to
  }
  return out
}

/** Legacy CAMERA_STATES export built from the first beat of each chapter. */
export const CAMERA_STATES = buildChapterStates(false)
