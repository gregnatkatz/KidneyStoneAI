/**
 * Developed by Gregory Katz (@gregorykatz_microsoft)
 */

import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: [
      'kidney-stone-agent-tunnel-cwbk1blg.devinapps.com',
      'kidney-stone-agent-tunnel-q62eive9.devinapps.com',
      '.devinapps.com'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/images': {
        target: 'http://localhost:8002',
        changeOrigin: true
      },
      '/patients': {
        target: 'http://localhost:8002',
        changeOrigin: true
      },
      '/agents': {
        target: 'http://localhost:8002',
        changeOrigin: true
      },
      '/rag': {
        target: 'http://localhost:8002',
        changeOrigin: true
      },
      '/auth': {
        target: 'http://localhost:8002',
        changeOrigin: true
      },
      '/azure-ml': {
        target: 'http://localhost:8002',
        changeOrigin: true
      }
    }
  }
})

