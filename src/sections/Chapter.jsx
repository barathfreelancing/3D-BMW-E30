import Beat, { Signal } from '../components/Beat'
import { CalloutLayer } from '../components/CalloutLayer'

/**
 * ==========================================================================
   CHAPTER
   ==========================================================================
   One chapter = one continuous run of beats inside a single <section>.
   The section is deliberately NOT a stacking context (no z-index, transform,
   opacity or filter up to `.beat`) so a beat's back layer can sit at
   z-index 0, BEHIND the fixed canvas at z-index 1, while the text sits at
   z-index 3 in front of it. That layering is the whole reason the car reads
   as an object inside the typography instead of sitting beside it.
*/

/** Archive index, not a heading: "01 ▬ THE BEGINNING", tight, then the title. */
export function ChapterHead({ chapter, hero = false }) {
  const rx = (mode) => (hero ? 'hero' : mode)
  return (
    <header className="chapter__head" data-reveal={hero ? undefined : true}>
      <p className="chapter__index t-index" data-rx={rx(true)}>
        <span className="chapter__num">{chapter.chapter}</span>
        <Signal />
        <span className="chapter__eyebrow">{chapter.eyebrow}</span>
      </p>
      <h2 id={`${chapter.id}-title`} className="chapter__title t-title">
        <span className="mask">
          <span data-rx={rx('line')}>{chapter.title}</span>
        </span>
      </h2>
    </header>
  )
}

function ChapterBeats({ chapter }) {
  return chapter.beats.map((beat) => (
    <Beat
      key={beat.id}
      beat={beat}
      chapterId={chapter.id}
      chapter={chapter}
      generations={chapter.generations || []}
    />
  ))
}

export default function Chapter({ chapter, chapterIndex }) {
  const callouts = chapter.beats
    .filter((b) => b.anchor)
    .map((b) => ({ id: b.id, index: b.index, label: b.label, leader: b.leader || [1, -1] }))

  return (
    <section
      id={chapter.id}
      className={`chapter chapter--${chapter.theme}`}
      data-camera={chapter.camera}
      data-chapter-index={chapterIndex}
      aria-labelledby={`${chapter.id}-title`}
    >
      <ChapterHead chapter={chapter} />
      <ChapterBeats chapter={chapter} />
      <CalloutLayer items={callouts} />
    </section>
  )
}
