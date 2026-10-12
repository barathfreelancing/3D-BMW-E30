import { chapters } from '../data/e30Story'
import { useActiveChapter } from '../hooks/useActiveChapter'
import { Signal } from './Beat'

/**
 * Fixed chapter index. Every link is a real in-page anchor with a visible
 * focus ring and a 44px hit target, so the whole film is navigable by keyboard
 * without ever touching the scroll timeline.
 */
export default function Navigation() {
  const active = useActiveChapter()
  const current = active >= 0 ? chapters[active] : null

  return (
    <header className="nav">
      <a className="nav__brand t-label" href="#top" aria-label="BMW E30 M3, back to top">
        <Signal />
        <span className="nav__brand-name">BMW E30 M3</span>
      </a>

      <nav className="nav__chapters" aria-label="Chapters">
        <span className="nav__current t-label" aria-hidden="true">
          {current ? `${current.chapter} · ${current.title}` : ''}
        </span>
        <ol className="nav__list">
          {chapters.map((c, i) => (
            <li key={c.id}>
              <a
                className="nav__link t-label"
                href={`#${c.id}`}
                aria-label={`Chapter ${c.chapter}: ${c.title}`}
                aria-current={active === i ? 'true' : undefined}
              >
                {c.chapter}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </header>
  )
}
