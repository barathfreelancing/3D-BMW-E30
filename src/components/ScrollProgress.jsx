import { chapters } from '../data/e30Story'
import { useActiveChapter } from '../hooks/useActiveChapter'

/**
 * Document progress rail. Decorative: the navigation already exposes the
 * current chapter through `aria-current`, so this is hidden from assistive
 * technology. The fill element is written directly by a ScrollTrigger in
 * `useChapterTracking` — no re-render per scroll tick.
 */
export default function ScrollProgress({ railRef }) {
  const active = useActiveChapter()
  const label = active >= 0 ? chapters[active].chapter : '——'

  return (
    <div className="progress" aria-hidden="true">
      <p className="progress__label t-label">
        {label} / {String(chapters.length).padStart(2, '0')}
      </p>
      <span className="progress__track">
        <span ref={railRef} className="progress__fill" />
      </span>
    </div>
  )
}
