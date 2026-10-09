import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // three + r3f + drei are large by nature; the GLB is served from /public.
    chunkSizeWarningLimit: 1500,
  },
})
