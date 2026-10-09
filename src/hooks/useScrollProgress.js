import { useEffect, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Returns the index of the chapter currently in view (-1 = hero / none).
 * Sections opt in with data-chapter-index="N".
 *
 * If a lineRef is passed, the whole-page progress is written straight to that
 * element as scaleY, with no React re-render per scroll tick.
 */
export function useScrollProgress(lineRef) {
  const [active, setActive] = useState(-1)

  useEffect(() => {
    const ctx = gsap.context(() => {
      document.querySelectorAll('[data-chapter-index]').forEach((el) => {
        const index = Number(el.dataset.chapterIndex)
        ScrollTrigger.create({
          trigger: el,
          start: 'top 55%',
          end: 'bottom 55%',
          onToggle: (self) => {
            if (self.isActive) setActive(index)
          },
        })
      })

      if (lineRef?.current) {
        const line = lineRef.current
        ScrollTrigger.create({
          start: 0,
          end: 'max',
          onUpdate: (self) => {
            line.style.transform = `scaleY(${self.progress})`
          },
        })
      }
    })
    return () => ctx.revert()
  }, [lineRef])

  return active
}
