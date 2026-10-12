import { useLayoutEffect, useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ChapterHead } from '../sections/Chapter'
import { CalloutLayer } from '../components/CalloutLayer'
import Beat from '../components/Beat'
import { e30Story } from '../data/e30Story'

gsap.registerPlugin(ScrollTrigger)

/**
 * ==========================================================================
   CHAPTER 01 — THE BEGINNING (also the hero)
   ==========================================================================
   This keeps the original landmarks: `#top` for the skip/back links and
   `data-camera="hero"` for the opening camera rig.

   The first frame is composed like a title card:
     top-left      archive index + chapter title
     centre/right  the car (the rig shifts it right of centre)
     lower-left    the opening statement, held while the camera settles
     bottom edge   scroll cue · BMW E30 M3 signature

   Layering (see layout.css):
     year (z0)  <  fixed 3D canvas (z1)  <  scene veil (z2)  <  text (z3)
*/
export default function Hero({ chapterIndex = 0, ready, reducedMotion }) {
  const chapter = e30Story.beginning
  const heroRef = useRef(null)

  // The orchestrated opening: once the model is ready, the title card comes in
  // as one timeline. Before that everything is held hidden (no flash).
  useLayoutEffect(() => {
    if (reducedMotion || !ready) return
    const ctx = gsap.context(() => {
      const parts = heroRef.current?.querySelectorAll('[data-rx="hero"]')
      if (parts?.length) gsap.set(parts, { autoAlpha: 0, yPercent: 108 })
      gsap.set('[data-fade]', { autoAlpha: 0 })

      gsap
        .timeline({ delay: 0.5 })
        .to(parts, { yPercent: 0, autoAlpha: 1, duration: 1.4, ease: 'expo.out', stagger: 0.1 }, 0)
        .to('[data-fade]', { autoAlpha: 1, duration: 1.2, ease: 'power2.out', stagger: 0.1 }, 0.9)
    }, heroRef)
    return () => ctx.revert()
  }, [ready, reducedMotion])

  // Scroll: the title card's chrome steps aside so the car carries the cut.
  useEffect(() => {
    if (reducedMotion || !ready) return
    const ctx = gsap.context(() => {
      gsap.to('.hero__frame', {
        autoAlpha: 0,
        ease: 'none',
        scrollTrigger: { trigger: heroRef.current, start: 'top top', end: '+=55%', scrub: true },
      })
    }, heroRef)
    return () => ctx.revert()
  }, [reducedMotion, ready])

  const callouts = chapter.beats
    .filter((b) => b.anchor)
    .map((b) => ({ id: b.id, index: b.index, label: b.label, leader: b.leader || [1, -1] }))

  return (
    <section
      ref={heroRef}
      id="top"
      className="hero chapter chapter--calm"
      data-camera="hero"
      data-chapter-index={chapterIndex}
      aria-labelledby={`${chapter.id}-title`}
    >
      <h1 className="sr-only">
        {e30Story.meta.title} — {e30Story.meta.subtitle}
      </h1>

      <div className="hero__frame">
        <ChapterHead chapter={chapter} hero />
        <div className="hero__base">
          <a className="cue t-label" href="#origin" data-fade>
            <span className="cue__line" aria-hidden="true" />
            {chapter.cue}
          </a>
          <p className="hero__signature" data-fade>
            <span className="hero__signature-name">{e30Story.meta.title}</span>
            <span className="t-label">1986 · {e30Story.meta.subtitle}</span>
          </p>
        </div>
      </div>

      {chapter.beats.map((beat) => (
        <Beat
          key={beat.id}
          beat={beat}
          chapterId={chapter.id}
          chapter={chapter}
          hero={beat.id === 'open'}
        />
      ))}

      <CalloutLayer items={callouts} />
    </section>
  )
}
