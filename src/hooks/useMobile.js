import { useEffect, useState } from 'react'

const QUERY = '(max-width: 810px)'

/**
 * Viewport class for the camera rigs. Read once per viewport, never per frame:
 * `buildTimeline()` produces the whole beat list for the current class, so a
 * rotation into or out of portrait rebuilds it exactly once.
 *
 * Must match the `mobile` state in ModelScene (same breakpoint) so the DOM rig
 * and the projected callout positions agree.
 */
export function useMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = (e) => setMobile(e.matches)
    setMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return mobile
}
