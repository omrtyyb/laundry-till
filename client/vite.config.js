import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward /api requests to the Node server during development.
    // API_PORT can point it at a server on another port (3001 if not set).
    proxy: {
      '/api': `http://localhost:${process.env.API_PORT || 3001}`,
    },
  },
})
