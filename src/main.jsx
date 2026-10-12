import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'

import './styles/globals.css'
import './styles/typography.css'
import './styles/layout.css'

import App from './App'

gsap.registerPlugin(ScrollTrigger)

// Mobile URL-bar show/hide fires resize; don't re-measure every ScrollTrigger.
ScrollTrigger.config({ ignoreMobileResize: true })

// Re-measure once webfonts have settled (they change every beat's height, and
// beat heights are what the camera rig is measured against).
document.fonts?.ready.then(() => ScrollTrigger.refresh())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
