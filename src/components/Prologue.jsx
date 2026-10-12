import { prologue } from '../data/e30Story'

/**
 * ==========================================================================
   PROLOGUE
   ==========================================================================
   Pure scroll space before chapter 01: one screen per prologue beat, no
   type. Everything you see is the 3D rig (headlamps, approach, bonnet light)
   and the `dark` channel blacking out the studio — both driven from the beat
   rows in e30Story.js by the same timeline as the rest of the film.

   The only element is a hairline scroll cue on the first screen, so a black
   page never reads as a broken one; it scrolls away with the first beat.
*/
export default function Prologue() {
  return (
    <section className="prologue" aria-label="Prologue: the headlamps of a BMW E30 M3 ignite in the dark">
      {prologue.beats.map((b) => (
        <article className="beat beat--prologue" data-beat={b.id} data-chapter="prologue" key={b.id} aria-hidden="true">
          {b.cue && (
            <>
              <span className="prologue__hint t-label">Scroll down</span>
              <span className="prologue__cue">
                <span className="prologue__cue-line" />
              </span>
            </>
          )}
        </article>
      ))}
    </section>
  )
}
