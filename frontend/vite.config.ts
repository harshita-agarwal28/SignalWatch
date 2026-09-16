import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxying /api and /socket.io to the backend means the browser only ever
// talks to its own origin in dev - no CORS configuration needed, and no
// VITE_API_URL required unless the backend is deployed elsewhere.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
      },
    },
  },
})
