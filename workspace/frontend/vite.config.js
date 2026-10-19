import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // amazon-cognito-identity-js references the Node global `global`; map it to
  // the browser's globalThis so the SDK loads in the browser.
  define: {
    global: 'globalThis',
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false // Disables sourcemap transformation to prevent Rolldown binding errors
  }
})
