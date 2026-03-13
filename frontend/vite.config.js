import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/incidents': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/playbooks': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/run-pipeline': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        method: 'POST'
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  }
})
