import { useRef, useState } from 'react'
import ModelScene, { ModelLoadingOverlay } from './components/ModelScene'
import Navigation from './components/Navigation'
import ScrollProgress from './components/ScrollProgress'
import Atmosphere from './components/Atmosphere'
import Hero from './components/Hero'
import Prologue from './components/Prologue'
import Chapter from './sections/Chapter'
import { chapters } from './data/e30Story'
import { useLenis } from './hooks/useLenis'
import { useReducedMotion } from './hooks/useReducedMotion'
import { useChapterTracking } from './hooks/useActiveChapter'
import { useReveal, useStoryTimeline } from './hooks/useStoryTimeline'
import { useMobile } from './hooks/useMobile'

/**
 * ==========================================================================
   APP
   ==========================================================================
   The whole experience hangs off three signals, none of which live in React
   state during a scroll:

     scroll position ──► useStoryTimeline ──► runtime.target  (the rig)
                                                     │
                                       ┌─────────────┴─────────────┐
                                       ▼                           ▼
                              RigDriver (inside Canvas)     Atmosphere CSS
                              camera · model · light         veil · energy

   `ready` is the only state here, and it flips once for the whole session.
*/
export default function App() {
  const reducedMotion = useReducedMotion()
  const mobile = useMobile()
  const storyRef = useRef(null)
  const railRef = useRef(null)
  const [ready, setReady] = useState(false)

  useLenis(!reducedMotion)
  useStoryTimeline({ rootRef: storyRef, reducedMotion, mobile })
  useReveal(storyRef, reducedMotion, ready)
  useChapterTracking({ rootRef: storyRef, fillRef: railRef })

  const rest = chapters.slice(1)

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <Atmosphere />
      <ModelScene
        reducedMotion={reducedMotion}
        onReady={() => setReady(true)}
      />
      {/* Owns its own load status and timeout; "continue" only matters on failure. */}
      <ModelLoadingOverlay onContinue={() => setReady(true)} />
      <Navigation />
      <ScrollProgress railRef={railRef} />

      <main id="main" ref={storyRef} className="story">
        <Prologue />
        <Hero chapterIndex={0} ready={ready} reducedMotion={reducedMotion} />

        {rest.map((chapter, i) => (
          <Chapter key={chapter.id} chapter={chapter} chapterIndex={i + 1} />
        ))}
      </main>
    </>
  )
}
