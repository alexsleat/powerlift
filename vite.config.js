import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // bind to 0.0.0.0 so Docker can expose it
    port: 5173,
    proxy: {
      // Forward /api requests to the backend during local development
      '/api': {
        target:      'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})