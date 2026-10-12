/**
 * ==========================================================================
   ATMOSPHERE
   ==========================================================================
   Fixed, non-interactive layers: the studio behind the car (z0), and the
   film-stock grade over everything. Two separate veils on purpose:
     - .veil-scene (z2): dims the car and the studio, NOT the type.
     - .grade (z60): vignette, grain and the closing final veil (takes the
       whole frame, text included, at the very end).
   `--veil` and `--final` are written by RigDriver from the same scroll rig
   that drives the camera, so the atmosphere cannot drift out of step with the
   story.
*/
export default function Atmosphere() {
  return (
    <>
      {/* The studio: graphite walls, far softboxes, a cool haze around the
          car, one warm spill at floor level and a measured scale. */}
      <div className="atmos" aria-hidden="true">
        <div className="atmos__base" />
        <div className="atmos__panels">
          <span className="atmos__panel atmos__panel--1" />
          <span className="atmos__panel atmos__panel--2" />
          <span className="atmos__panel atmos__panel--3" />
          <span className="atmos__panel atmos__panel--4" />
        </div>
        <div className="atmos__haze" />
        <div className="atmos__spill" />
        <div className="atmos__scale" />
        {/* the prologue's black: lifts as the `dark` channel goes 1 -> 0 */}
        <div className="atmos__void" />
      </div>
      <div className="veil-scene" aria-hidden="true" />
      <div className="grade" aria-hidden="true">
        <div className="grade__vignette" />
        <div className="grade__grain" />
        <div className="grade__veil" />
      </div>
    </>
  )
}