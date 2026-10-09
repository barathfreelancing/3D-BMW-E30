import { useEffect } from 'react'
import { useSyncExternalStore } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * ==========================================================================
 * CHAPTER TRACKING
 * ==========================================================================
 *
 * Which chapter owns the viewport right now, plus the document progress rail.
 *
 * A module-level store rather than component state: the value changes six
 * times over the whole story, so React re-renders exactly when the chapter
 * actually changes and never on a scroll tick. The progress rail is written
 * straight to a DOM node by the trigger's own onUpdate.
 */
let active = -1
const listeners = new Set()

const subscribe = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const getSnapshot = () => active

function setActiveChapter(index) {
  if (index === active) return
  active = index
  for (const fn of listeners) fn()
}

export function useActiveChapter() {
  return useSyncExternalStore(subscribe, getSnapshot, () => -1)
}

/**
 * @param rootRef  the story container
 * @param fillRef  optional element that receives scaleY(0..1) document progress
 */
export function useChapterTracking({ rootRef, fillRef }) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      root.querySelectorAll('[data-chapter-index]').forEach((el) => {
        const index = Number(el.dataset.chapterIndex)
        if (!Number.isFinite(index)) return
        ScrollTrigger.create({
          trigger: el,
          start: 'top 55%',
          end: 'bottom 55%',
          onToggle: (self) => {
            if (self.isActive) setActiveChapter(index)
          },
        })
      })

      if (fillRef?.current) {
        const line = fillRef.current
        ScrollTrigger.create({
          start: 0,
          end: 'max',
          onUpdate: (self) => {
            line.style.transform = `scaleY(${self.progress})`
          },
        })
      }
    }, root)

    return () => {
      ctx.revert()
      setActiveChapter(-1)
    }
  }, [rootRef, fillRef])
}
