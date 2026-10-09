import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { beats } from '../data/e30Story'
import { buildTimeline, ease, lerpRig, makeRig } from '../data/cameraStates'
import { runtime, setActiveBeat } from '../runtime'

gsap.registerPlugin(ScrollTrigger)

/**
 * ==========================================================================
 * THE SCROLL STORYTELLING SYSTEM
 * ==========================================================================
 *
 * One master ScrollTrigger over the whole story container. On every scroll
 * tick it reads the absolute scroll position, finds the beat whose section
 * owns that position, and writes an interpolated rig into `runtime.target`.
 * The Canvas consumes that rig in `RigDriver` — one write per frame, zero
 * React renders.
 *
 * Why one trigger instead of one trigger per beat:
 *   - beats can be freely re-ordered or re-timed in the data file without
 *     touching animation code;
 *   - there is exactly one scrubbed timeline, so a fast flick can never leave
 *     two camera tweens fighting each other;
 *   - cleanup is a single `kill()`.
 *
 * MEASUREMENT. Beat ranges are read from the DOM (offsetTop/height) and
 * re-measured on ScrollTrigger refresh, font load and resize. Between
 * measurements the previous ranges are reused, so a resize mid-scroll
 * degrades to a slightly stale camera rather than a broken one.
 *
 * REDUCED MOTION. The target snaps to the active beat instead of easing into
 * it, and RigDriver damps with a low lambda, so the camera still changes with
 * the chapter but never travels *through* the space between two framings.
 */
export function useStoryTimeline({ rootRef, reducedMotion, mobile }) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const timeline = buildTimeline(mobile)
    const target = makeRig(timeline[0].from)
    runtime.target = target

    /** @type {{beat: object, el: HTMLElement, start: number, end: number}[]} */
    let ranges = []

    const measure = () => {
      const nodes = root.querySelectorAll('[data-beat]')
      if (!nodes.length) return
      const next = []
      const vh = window.innerHeight
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - vh)
      for (const el of nodes) {
        const entry = timeline.find((t) => t.id === el.dataset.beat)
        if (!entry) continue
        const rect = el.getBoundingClientRect()
        const top = rect.top + window.scrollY
        // The camera move starts as the beat's text enters (beat top at 75% of
        // the viewport) and lands 15% into the beat, so the framing has
        // arrived while the text is held on screen, then holds until the
        // next beat enters. Ranges don't overlap while every beat is taller
        // than 0.88 viewports (0.85·h > 0.75·vh); layout.css keeps them ≥ 1.
        const start = Math.max(0, top - vh * 0.75)
        const end = Math.min(maxScroll, Math.max(start + 1, top + rect.height * 0.15))
        next.push({ beat: entry, el, start, end })
      }
      if (next.length) ranges = next
    }

    /** Absolute scroll position -> interpolated rig + active beat id. */
    const resolve = (y) => {
      if (!ranges.length || !Number.isFinite(y)) return
      // The active beat is the last one whose move has started. Between one
      // beat's landing and the next one's start it stays active at t = 1,
      // holding its framing — and its callout — until the next beat enters.
      let active = ranges[0]
      for (let i = 0; i < ranges.length; i++) {
        if (y < ranges[i].start) break
        active = ranges[i]
      }
      const { beat, start, end } = active
      const span = end - start
      const raw = span > 0 ? (y - start) / span : 1
      const t = Math.min(1, Math.max(0, raw))

      if (reducedMotion) {
        // Hold the framing the beat was authored for; no interpolation.
        for (const k in target) target[k] = beat.to[k]
      } else {
        lerpRig(target, beat.from, beat.to, ease(beat.ease, t))
      }

      runtime.progress = Math.min(1, Math.max(0, y / Math.max(1, document.body.scrollHeight - window.innerHeight)))
      setActiveBeat(beat.id)
    }

    measure()

    const master = ScrollTrigger.create({
      trigger: root,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => resolve(self.scroll()),
      // `self` MUST be the parameter: unbound it silently resolves to
      // window.self, whose scroll() returns undefined and NaNs the whole rig.
      onRefresh: (self) => {
        measure()
        // Re-resolve so a refresh (font load, image decode, rotation) never
        // leaves the camera one frame behind the text.
        resolve(self.scroll())
      },
      onRefreshInit: () => measure(),
    })

    // Fonts change beat heights. Images and the loader overlay do not sit
    // inside a beat, but plates decode after mount, so observe the container.
    let raf = 0
    const reschedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        measure()
        ScrollTrigger.refresh()
      })
    }
    document.fonts?.ready.then(reschedule)

    const ro = new ResizeObserver(reschedule)
    ro.observe(root)

    resolve(window.scrollY)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      master.kill()
      runtime.target = null
    }
  }, [rootRef, reducedMotion, mobile])
}

/**
 * Beat text reveals. Each beat's masked lines and paragraphs animate in once,
 * as its section reaches the reading line, and reverse when it leaves upward.
 * Hero opening beats (data-rx="hero") are handled by Hero.jsx and skipped here.
 *
 * Under reduced motion the elements are simply set visible: the story stays
 * fully legible with no movement at all, which is also the CSS fallback if
 * JavaScript never runs.
 */
export function useReveal(rootRef, reducedMotion, ready) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      root.querySelectorAll('[data-beat], [data-reveal]').forEach((beatEl) => {
        // Type behind the car (words, numerals, years) exists only while its
        // own beat owns the frame: scrubbed in as the beat arrives, out as it
        // leaves, so it never bleeds into the neighbouring beats.
        const back = beatEl.querySelectorAll(':scope > .beat__back, :scope > .beat__year')
        if (back.length && !reducedMotion) {
          gsap
            .timeline({ scrollTrigger: { trigger: beatEl, start: 'top 55%', end: 'bottom 45%', scrub: true } })
            .fromTo(back, { autoAlpha: 0 }, { autoAlpha: 1, ease: 'none', duration: 0.3 })
            .to(back, { autoAlpha: 1, duration: 0.4 })
            .to(back, { autoAlpha: 0, ease: 'none', duration: 0.3 })
        }

        const parts = beatEl.querySelectorAll('[data-rx]:not([data-rx="hero"])')
        if (!parts.length) return

        if (reducedMotion) {
          gsap.set(parts, { autoAlpha: 1, yPercent: 0, y: 0, clearProps: 'transform' })
          return
        }

        parts.forEach((part) => {
          const mode = part.dataset.rx
          const from =
            mode === 'line'
              ? { autoAlpha: 0, yPercent: 108 }
              : mode === 'rise'
                ? { autoAlpha: 0, y: 26 }
                : { autoAlpha: 0 }
          const to = { autoAlpha: 1, yPercent: 0, y: 0, ease: 'expo.out', duration: 1.15 }
          gsap.fromTo(part, from, {
            ...to,
            delay: Number(part.dataset.rxDelay || 0),
            scrollTrigger: {
              trigger: beatEl,
              start: 'top 76%',
              toggleActions: 'play none none reverse',
            },
          })
        })
      })
    }, root)

    return () => ctx.revert()
  }, [rootRef, reducedMotion, ready])
}

/**
 * Chapter tracking for the navigation and the rail: publishes the index of
 * the chapter whose section owns the middle of the viewport, and writes the
 * whole-document progress straight onto a DOM node (no state).
 */
export function useChapterTracking({ rootRef, reducedMotion, fillRef }) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      const sections = root.querySelectorAll('[data-chapter-index]')
      sections.forEach((el, i) => {
        const index = Number(el.dataset.chapterIndex)
        if (!Number.isFinite(index)) return
        ScrollTrigger.create({
          trigger: el,
          start: 'top 55%',
          end: 'bottom 55%',
          onToggle: (self) => {
            if (!self.isActive) return
            document.documentElement.dataset.chapter = String(index)
          },
          onUpdate: (self) => {
            if (i === 0 && fillRef?.current && !reducedMotion) {
              fillRef.current.style.transform = `scaleY(${self.progress})`
            }
          },
        })
      })

      if (fillRef?.current) {
        ScrollTrigger.create({
          start: 0,
          end: 'max',
          onUpdate: (self) => {
            fillRef.current.style.transform = `scaleY(${self.progress})`
          },
        })
      }
    }, root)

    return () => {
      delete document.documentElement.dataset.chapter
      ctx.revert()
    }
  }, [rootRef, reducedMotion, fillRef])
}

export { beats }
