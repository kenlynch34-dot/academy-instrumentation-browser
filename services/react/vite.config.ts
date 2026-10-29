import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// add configuration to proxy requests from /backend to http://localhost:10115/
export default defineConfig({
  test: {
    environment: 'jsdom'
  },
  plugins: [react()],
  // read .env from the repo root and expose HONEYCOMB_* vars to the browser
  envDir: '../..',
  envPrefix: ['VITE_', 'HONEYCOMB_'],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:10115',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
