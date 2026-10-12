import { useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Smooth scrolling, driven by GSAP's ticker so the whole page has ONE
 * animation loop: gsap.ticker -> lenis.raf -> ScrollTrigger.update.
 * (The r3f canvas is also advanced from this same ticker; see ModelScene.)
 *
 * Disabled entirely under reduced motion: native scrolling is used instead.
 */
export function useLenis(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      anchors: true, // in-page #links scroll through Lenis
      // autoRaf stays false: we drive raf from gsap.ticker below.
    })

    lenis.on('scroll', ScrollTrigger.update)

    const tick = (time) => lenis.raf(time * 1000) // gsap time is seconds
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0) // keep Lenis and ScrollTrigger in lockstep

    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
    }
  }, [enabled])
}
