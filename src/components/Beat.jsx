import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useReducedMotion } from '../hooks/useReducedMotion'
import GenerationGallery from './GenerationGallery'

gsap.registerPlugin(ScrollTrigger)

/* ==========================================================================
   BEAT
   One scroll position in the film. The beat owns the text; the 3D rig owns
   the camera, the model's attitude and the light — both are driven from the
   same data row in src/data/e30Story.js, which is why they stay in step.

   Two layers per beat:
     .beat__back   z0, BEHIND the canvas: giant words, numerals, years. The car
                   cuts across them, so type and model read as one frame.
     .beat__inner  z3, in front: held on screen (sticky) while the camera
                   settles, then released as the next beat enters.

   Typographic roles (typography.css): t-index · t-title · t-statement ·
   t-subject · t-label · t-body · t-word / t-numeral.
   ========================================================================== */

/** Small M-colour signal: three hairline segments, used once per marker. */
export function Signal() {
  return (
    <span className="signal" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  )
}

/** Facts as a quiet editorial spec list, with an optional qualifier line. */
function Spec({ facts, qualifier }) {
  if (!facts?.length) return null
  return (
    <div className="spec-block" data-rx data-rx-delay="0.18">
      <dl className="spec">
        {facts.map((f) => (
          <div className="spec__row" key={f.label}>
            <dt className="t-label">{f.label}</dt>
            <dd className="spec__value">{f.value}</dd>
          </div>
        ))}
      </dl>
      {qualifier && <p className="spec__qualifier t-caption">{qualifier}</p>}
    </div>
  )
}

/** Results set as an archive ledger: year, series, driver, team. */
function Ledger({ rows }) {
  if (!rows?.length) return null
  return (
    <ol className="ledger" data-rx="rise" data-rx-delay="0.14">
      {rows.map((r) => (
        <li className="ledger__row" key={`${r.year}-${r.series}`}>
          <span className="ledger__year t-label">{r.year}</span>
          <span className="ledger__entry">
            <span className="ledger__series">{r.series}</span>
            <span className="ledger__driver t-body">
              {r.driver}
              {r.team && <span className="ledger__team t-label">{r.team}</span>}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/**
 * Masked display lines: each span rises out of an overflow-hidden box.
 * A line may be `{ text, em: true }` — set heavy and uppercase, the one word
 * the statement turns on.
 */
function Lines({ lines, id, className, hero }) {
  return (
    <h3 id={id} className={`beat__lines ${className}`}>
      {lines.map((line, i) => {
        const text = typeof line === 'string' ? line : line.text
        const em = typeof line === 'object' && line.em
        return (
          <span className="mask" key={`${i}-${text}`}>
            <span data-rx={hero ? 'hero' : 'line'}>{em ? <em>{text}</em> : text}</span>
          </span>
        )
      })}
    </h3>
  )
}

function Label({ children, hero, delay = 0 }) {
  if (!children) return null
  const parts = Array.isArray(children) ? children : [children]
  return (
    <p className="beat__label t-label" data-rx={hero ? 'hero' : true} data-rx-delay={delay}>
      {parts.map((part) => (
        <span className="beat__label-line" key={part}>
          {part}
        </span>
      ))}
    </p>
  )
}

function Body({ children, hero, delay = 0.14 }) {
  if (!children) return null
  return (
    <p className="beat__body t-body" data-rx={hero ? 'hero' : 'rise'} data-rx-delay={delay}>
      {children}
    </p>
  )
}

/** The 5,000 moment: a numeral that counts up once, then holds. */
function CountUp({ value, id, label }) {
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const digits = value.replace(/[^0-9]/g, '')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduced || !digits) {
      el.textContent = value
      return
    }
    const format = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    const obj = { n: 0 }
    const tween = gsap.to(obj, {
      n: Number(digits),
      duration: 1.9,
      ease: 'power3.out',
      onUpdate: () => {
        el.textContent = format(Math.round(obj.n))
      },
      scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' },
    })
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [value, digits, reduced])

  return (
    <h3 id={id} className="t-numeral" aria-label={`${value} — ${[].concat(label).join(' ')}`}>
      <span ref={ref} aria-hidden="true">
        {value}
      </span>
    </h3>
  )
}

/* ---------------------------------------------------------------------------
   KIND RENDERERS — each returns { back, front }.
   --------------------------------------------------------------------------- */

const statementClass = (beat) => (beat.variant === 'title' ? 't-title' : 't-statement')

const KINDS = {
  line: ({ beat, headingId, hero }) => ({
    front: (
      <>
        <Label hero={hero}>{beat.label}</Label>
        <Lines lines={beat.lines} id={headingId} className={statementClass(beat)} hero={hero} />
        <Body hero={hero}>{beat.body}</Body>
        <Spec facts={beat.facts} />
      </>
    ),
  }),

  word: ({ beat, headingId }) => ({
    back: (
      <h3 id={headingId} className="t-word" data-rx="rise" style={{ '--chars': beat.word.length }}>
        {beat.word}
      </h3>
    ),
    front: (
      <>
        <Label>{beat.label}</Label>
        <Body delay={0.1}>{beat.body}</Body>
        <Spec facts={beat.facts} />
      </>
    ),
  }),

  year: ({ beat, headingId }) => ({
    front: (
      <>
        {beat.kicker && (
          <p className="beat__kicker t-label" data-rx>
            {beat.kicker.map((k) => (
              <span key={k}>{k}</span>
            ))}
          </p>
        )}
        <Lines lines={beat.lines} id={headingId} className={statementClass(beat)} />
        {beat.caption && (
          <p className="beat__caption t-label" data-rx data-rx-delay="0.2">
            {beat.caption}
          </p>
        )}
      </>
    ),
  }),

  'year-only': ({ beat, headingId }) => ({
    front: (
      <>
        <Label>{beat.label}</Label>
        <Lines lines={beat.lines} id={headingId} className={statementClass(beat)} />
        <Body>{beat.body}</Body>
        <Spec facts={beat.facts} />
      </>
    ),
  }),

  number: ({ beat, headingId }) => ({
    back: <CountUp value={beat.value} id={headingId} label={beat.label} />,
    front: (
      <>
        <Label>{beat.label}</Label>
        <Body delay={0.1}>{beat.body}</Body>
        <Spec facts={beat.facts} />
      </>
    ),
  }),

  // With a `figure` (03 THE MACHINE) the big value leads and the subject
  // moves onto the index line; without one (05 THE ICON) the subject leads.
  callout: ({ beat, headingId, chapter }) => ({
    front: (
      <>
        <p className="beat__index t-index" data-rx>
          <Signal />
          {chapter.chapter}.{beat.index}
          {beat.figure && <span className="beat__index-subject">{beat.label}</span>}
        </p>
        {beat.figure ? (
          <div className="beat__figure" data-rx="rise">
            <p className="t-figure">{beat.figure}</p>
            {beat.figureSub && <p className="beat__figure-sub t-label">{beat.figureSub}</p>}
          </div>
        ) : (
          <p className="beat__subject t-subject" data-rx="rise" style={{ '--chars': beat.label.length }}>
            {beat.label}
          </p>
        )}
        <Lines lines={beat.lines} id={headingId} className="t-statement t-statement--sm" />
        <Spec facts={beat.facts} qualifier={beat.qualifier} />
      </>
    ),
  }),

  ledger: ({ beat, headingId }) => ({
    front: (
      <>
        <Label>{beat.label}</Label>
        <Lines lines={beat.lines} id={headingId} className="t-statement t-statement--sm" />
        <Ledger rows={beat.rows} />
      </>
    ),
  }),

  // The intro line flows in above; the plates are a full-bleed layer of
  // their own (see GenerationGallery).
  generations: ({ beat, headingId, generations }) => ({
    front: (
      <>
        <Label>{beat.label}</Label>
        <Lines lines={beat.lines} id={headingId} className="t-statement t-statement--sm" />
      </>
    ),
    full: <GenerationGallery items={generations} />,
  }),

  fade: ({ headingId }) => ({
    front: (
      <div className="credits">
        <p id={headingId} className="credits__head t-label" data-rx>
          <Signal />
          End of film
        </p>
        <p className="credits__back" data-rx data-rx-delay="0.3">
          <a href="#top" className="cue t-label">
            <span className="cue__line" aria-hidden="true" />
            Return to the beginning
          </a>
        </p>
      </div>
    ),
  }),
}

/* ---------------------------------------------------------------------------
   BEAT
   --------------------------------------------------------------------------- */

export default function Beat({ beat, chapterId, chapter, generations = [], hero = false }) {
  const headingId = `${beat.id}-title`
  const render = KINDS[beat.kind] || KINDS.line
  const { back, front, full } = render({ beat, headingId, chapter, generations, hero })
  const layout = beat.layout || 'left-upper'

  return (
    <article
      className={`beat beat--${beat.kind}`}
      data-beat={beat.id}
      data-chapter={chapterId}
      data-layout={layout}
      aria-labelledby={headingId}
    >
      {beat.year && (
        <p className="beat__year t-numeral" aria-hidden="true">
          {beat.year}
        </p>
      )}
      {back && <div className="beat__back">{back}</div>}
      <div className="beat__inner">{front}</div>
      {full}
    </article>
  )
}
