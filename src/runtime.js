// ===========================================================================
// STORY RUNTIME
//
// A plain module-level object shared by the DOM layer and the WebGL layer so
// scroll-driven state can cross the React/Canvas boundary without a single
// re-render. Written by `useStoryTimeline` (scroll) and `RigDriver` (frame),
// read by `CalloutLayer` and the chapter UI.
//
// Everything here is intentionally mutable and ref-less: these values change
// every frame and must never enter React state.
// ===========================================================================

import { anchoredBeats } from './data/e30Story'

/** Pre-allocated so the frame loop never allocates. */
const points = {}
for (const beat of anchoredBeats) {
  points[beat.id] = { x: 0, y: 0, on: false }
}

export const runtime = {
  /** Resolved target rig for the current scroll position (see cameraStates). */
  target: null,
  /** Id of the beat currently owning the film. */
  beat: null,
  /** Projected screen positions of anchored beats: id -> { x, y, on }. */
  points,
  /** Whole-document progress, 0..1. */
  progress: 0,
  /** True once the model has been parsed and its shaders compiled. */
  modelReady: false,
  /** Set when the model could not be loaded and the placeholder is on screen. */
  modelFailed: false,
  /** Refs to the lights the film modulates (key, rim, spill). */
  lights: null,
  /** The studio floor material (its red spill follows the energy channel). */
  floor: null,
  /** The reflective floor mesh (its opacity follows the active beat). */
  reflector: null,
  /** True while giant type layered behind the car is on screen. */
  backTypeOnScreen: false,
  /** The headlamp bowls' material (emissive driven by the `lamps` channel). */
  headlampMaterial: null,
  /** Halo + streak sprite materials around the headlamps. */
  headlampGlow: null,
  /** Subscribe to beat changes only — never to scroll ticks. */
  listeners: new Set(),
}

/** Publish the beat that currently owns the film (no-op if unchanged). */
export function setActiveBeat(id) {
  if (runtime.beat === id) return
  runtime.beat = id
  for (const fn of runtime.listeners) fn(id)
}

/** Subscribe to beat changes only — never to scroll ticks. */
export function onBeatChange(fn) {
  runtime.listeners.add(fn)
  return () => runtime.listeners.delete(fn)
}
