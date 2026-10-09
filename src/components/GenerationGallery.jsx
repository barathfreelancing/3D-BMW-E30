import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Signal } from './Beat'
import { useReducedMotion } from '../hooks/useReducedMotion'

gsap.registerPlugin(ScrollTrigger)

const BASE = import.meta.env.BASE_URL

/* ==========================================================================
   GENERATION GALLERY — 06 THE LEGACY, "It evolved."
   One full-screen plate per generation, held on a sticky stage while the
   beat scrolls past (no pin: the layout never changes, so the story
   timeline's measurements stay valid).

   Transitions, all scrubbed by scroll:
     first plate   the film fades to dark, then the plate rises from the
                   bottom out of that darkness (brightness 0 -> 1)
     later plates  a PIXELATE morph, on a canvas laid over the stage: the
                   current car breaks into ever larger blocks, swaps to the
                   next car at the coarsest point, then resolves back to a
                   sharp photograph. Shorter than the first transition, so
                   the sequence speeds up from the second car on.
     end           the last plate fades to dark, then the dark lifts and
                   the 3D film resumes (no crossfade of two different cars)

   Reduced motion: the plates stack as plain full-screen figures.
   ========================================================================== */

/** Timeline units. */
const INTRO = 1 // the first plate rising out of the dark
const PIXEL = 0.45 // each pixelate morph — the faster part of the sequence
const HOLD = 0.7 // every plate holds this long so it can be read
const OUTRO = 0.8

/** Coarsest block, in CSS px, at the midpoint of a morph. */
const MAX_BLOCK = { desktop: 64, mobile: 40 }

/** Scroll per timeline unit (svh). Keeps the old pace for the first plate. */
const SVH_PER_UNIT = 83

export const galleryUnits = (count) => INTRO + HOLD + Math.max(0, count - 1) * (PIXEL + HOLD) + OUTRO

/* ---------------------------------------------------------------------------
   Pixelation: draw the photo, `object-fit: cover`-style, into a tiny buffer
   (one pixel per block), then scale that buffer up with smoothing off.
   Two drawImage calls per frame, and only while a morph is in progress.
   --------------------------------------------------------------------------- */

const parsePos = (value) => {
  const [x = '50%', y = '50%'] = String(value || '').split(' ')
  const pct = (v) => (v.endsWith('%') ? parseFloat(v) / 100 : 0.5)
  return [pct(x), pct(y)]
}

function makePixelator(canvas) {
  const ctx = canvas.getContext('2d')
  const small = document.createElement('canvas')
  const sctx = small.getContext('2d')
  let w = 0
  let h = 0
  let dpr = 1

  const fit = () => {
    const rect = canvas.getBoundingClientRect()
    const nextDpr = Math.min(2, window.devicePixelRatio || 1)
    if (rect.width === w && rect.height === h && nextDpr === dpr) return
    w = rect.width
    h = rect.height
    dpr = nextDpr
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }

  /** Draws `img` with blocks of `block` CSS px; false if the image isn't ready. */
  return function draw(img, block) {
    if (!img?.complete || !img.naturalWidth) return false
    fit()
    if (!w || !h) return false

    const [fx, fy] = parsePos(getComputedStyle(img).objectPosition)
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
    const dw = img.naturalWidth * scale
    const dh = img.naturalHeight * scale
    const dx = (w - dw) * fx
    const dy = (h - dh) * fy

    const b = Math.max(1, block)
    const sw = Math.max(1, Math.ceil(w / b))
    const sh = Math.max(1, Math.ceil(h / b))
    if (small.width !== sw || small.height !== sh) {
      small.width = sw
      small.height = sh
    }
    sctx.imageSmoothingEnabled = true
    sctx.clearRect(0, 0, sw, sh)
    sctx.drawImage(img, (dx / w) * sw, (dy / h) * sh, (dw / w) * sw, (dh / h) * sh)

    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(small, 0, 0, sw, sh, 0, 0, canvas.width, canvas.height)

    // the plate's caption gradient, so the swap back to the <img> is seamless
    const H = canvas.height
    const g1 = ctx.createLinearGradient(0, H, 0, 0)
    g1.addColorStop(0, 'rgba(8,9,11,0.82)')
    g1.addColorStop(0.3, 'rgba(8,9,11,0.35)')
    g1.addColorStop(0.55, 'rgba(8,9,11,0)')
    ctx.fillStyle = g1
    ctx.fillRect(0, 0, canvas.width, H)
    const g2 = ctx.createLinearGradient(0, 0, 0, H * 0.18)
    g2.addColorStop(0, 'rgba(8,9,11,0.55)')
    g2.addColorStop(1, 'rgba(8,9,11,0)')
    ctx.fillStyle = g2
    ctx.fillRect(0, 0, canvas.width, H * 0.18)
    return true
  }
}

export default function GenerationGallery({ items = [] }) {
  const root = useRef(null)
  const reducedMotion = useReducedMotion()

  useLayoutEffect(() => {
    const el = root.current
    if (!el || reducedMotion || !items.length) return

    const ctx = gsap.context(() => {
      const stage = el.querySelector('.gallery__stage')
      const dark = el.querySelector('.gallery__dark')
      const canvas = el.querySelector('.gallery__pixels')
      const panels = gsap.utils.toArray('.gallery__panel', el)
      const imgs = panels.map((p) => p.querySelector('.gallery__img'))
      const caps = panels.map((p) => p.querySelector('.gallery__cap'))
      const draw = makePixelator(canvas)
      const maxBlock = () => (window.innerWidth <= 810 ? MAX_BLOCK.mobile : MAX_BLOCK.desktop)

      gsap.set(stage, { autoAlpha: 1 })
      gsap.set(dark, { autoAlpha: 0 })
      gsap.set(canvas, { autoAlpha: 0 })
      gsap.set(panels[0], { yPercent: 100 })
      gsap.set(imgs[0], { scale: 1.12, filter: 'brightness(0.12)' })
      gsap.set(panels.slice(1), { autoAlpha: 0 })
      gsap.set(caps, { autoAlpha: 0, y: 24 })

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: el, start: 'top top', end: 'bottom bottom', scrub: 0.5 },
      })

      // first plate: fade to dark, then rise out of it
      tl.to(dark, { autoAlpha: 1, duration: INTRO * 0.35 }, 0)
        .to(panels[0], { yPercent: 0, duration: INTRO, ease: 'power2.out' }, 0.1)
        .to(imgs[0], { scale: 1, filter: 'brightness(1)', duration: INTRO, ease: 'power1.out' }, 0.1)
        .to(caps[0], { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' }, INTRO * 0.75)

      // later plates: pixelate morph, prev -> blocks -> next -> sharp
      let t = INTRO + HOLD
      for (let i = 1; i < panels.length; i++) {
        const from = imgs[i - 1]
        const to = imgs[i]
        const next = panels[i]
        const morph = { p: 0 }
        const render = () => {
          const p = morph.p
          // the incoming plate is only "real" once the morph has finished
          next.style.visibility = p >= 1 ? 'visible' : 'hidden'
          next.style.opacity = p >= 1 ? '1' : '0'
          if (p <= 0 || p >= 1) {
            canvas.style.visibility = 'hidden'
            return
          }
          // 0 -> .5: the current car breaks up; .5 -> 1: the next resolves
          const half = p < 0.5
          const k = half ? p / 0.5 : (1 - p) / 0.5
          const block = 1 + (maxBlock() - 1) * k * k
          const ok = draw(half ? from : to, block)
          canvas.style.visibility = ok ? 'visible' : 'hidden'
          canvas.style.opacity = ok ? '1' : '0'
        }
        tl.to(caps[i - 1], { autoAlpha: 0, y: -16, duration: PIXEL * 0.3 }, t)
          .to(morph, { p: 1, duration: PIXEL, onUpdate: render }, t)
          .to(caps[i], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' }, t + PIXEL * 0.85)
        t += PIXEL + HOLD
      }

      // hand the frame back to the film: fade the last plate to dark first,
      // then lift the dark, so two different cars never cross-fade
      const last = panels.length - 1
      tl.to(caps[last], { autoAlpha: 0, y: -16, duration: 0.25 }, t)
        .to(imgs[last], { filter: 'brightness(0)', duration: OUTRO * 0.5 }, t)
        .set(panels, { autoAlpha: 0 }, t + OUTRO * 0.5)
        .to(stage, { autoAlpha: 0, duration: OUTRO * 0.5 }, t + OUTRO * 0.5)
    }, el)

    return () => ctx.revert()
  }, [items, reducedMotion])

  const count = items.length

  return (
    <div
      className={`gallery${reducedMotion ? ' gallery--static' : ''}`}
      ref={root}
      style={{ '--scroll': `${galleryUnits(count) * SVH_PER_UNIT}svh` }}
    >
      <div className="gallery__stage">
        <div className="gallery__dark" aria-hidden="true" />
        {items.map((g, i) => (
          <figure className={`gallery__panel${i === 0 ? ' is-origin' : ''}`} key={g.code}>
            <img
              className="gallery__img"
              src={`${BASE}${g.image}`}
              alt={g.alt}
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              style={g.focusMobile ? { '--focus-m': g.focusMobile } : undefined}
            />
            <figcaption className="gallery__cap">
              <span className="gallery__index t-index">
                <Signal />
                {String(i + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
              </span>
              <span className="gallery__code">{g.code}</span>
              <span className="gallery__meta">
                <span className="t-label">{g.label}</span>
                <span className="t-label gallery__year">{g.year}</span>
              </span>
              <span className="gallery__engine t-body">{g.engine}</span>
            </figcaption>
          </figure>
        ))}
        <canvas className="gallery__pixels" aria-hidden="true" />
      </div>
    </div>
  )
}
