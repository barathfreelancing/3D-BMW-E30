import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { runtime } from '../runtime'

/**
 * ==========================================================================
   CALLOUT LAYER
   ==========================================================================
   Each anchored beat owns a marker drawn at the screen position of a measured
   point on the car — an engine bay coordinate, a wheel-arch coordinate, the
   grille. RigDriver projects those world points to pixels every frame and
   writes them into `runtime.points`; this layer only reads them and sets a
   transform.

   That is what ties the words to the object: the label is not placed near the
   car, it is placed ON the car, and it follows the camera for free.

   Cost: one `style.transform` write per visible marker per frame, no React,
   no layout reads. Driven from gsap.ticker so it shares the single loop with
   Lenis, ScrollTrigger and the canvas.
*/
export function CalloutLayer({ items = [] }) {
  const root = useRef(null)

  useEffect(() => {
    if (!items.length) return
    const map = new Map()
    root.current?.querySelectorAll('[data-callout]').forEach((el) => {
      map.set(el.dataset.callout, el)
    })
    if (!map.size) return

    const write = () => {
      const active = runtime.beat
      for (const [id, el] of map) {
        const point = runtime.points[id]
        const on = Boolean(point?.on) && active === id
        const flag = on ? '1' : '0'
        if (el.dataset.state !== flag) {
          el.dataset.state = flag
          el.classList.toggle('is-on', on)
        }
        if (!on || !point) continue
        el.style.transform = `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0)`
      }
    }

    gsap.ticker.add(write)
    write()
    return () => gsap.ticker.remove(write)
  }, [items])

  if (!items.length) return null

  return (
    <div className="callouts" ref={root} aria-hidden="true">
      {items.map((item) => {
        const side = item.leader?.[0] >= 0 ? 'right' : 'left'
        return (
          <div
            className={`callout callout--${side}`}
            data-callout={item.id}
            data-state="0"
            key={item.id}
          >
            <span className="callout__dot" />
            <span className="callout__leader" />
            <span className="callout__tag t-label">
              <span className="callout__index">{item.index}</span>
              {item.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
