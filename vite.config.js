import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const backendPort = process.env.BACKEND_PORT || 8080

export default defineConfig({
  plugins: [vue()],
  server: {
    // Listen on the LAN too, so friends on the same network can join
    host: true,
    port: 5173,
    proxy: {
      '/api': `http://localhost:${backendPort}`,
      '/ws': { target: `ws://localhost:${backendPort}`, ws: true },
    },
  },
})
