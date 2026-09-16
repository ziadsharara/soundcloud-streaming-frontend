import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

const backendPort = process.env.BACKEND_PORT || 8080

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      // Ship a new shell as soon as one is available: a stale cached build talking to a newer
      // room API is the one failure mode that would be invisible and hard to explain.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['apple-touch-icon.png', 'icon.svg'],
      manifest: {
        id: '/',
        name: 'SoundStream',
        short_name: 'SoundStream',
        description: 'Listen to SoundCloud and YouTube together, in one room, in sync.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#fcfcfa',
        theme_color: '#1b1b1b',
        categories: ['music', 'social', 'entertainment'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        // Rooms are live: the API and the WebSocket must never be served from a cache.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/ws/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // A service worker in dev fights hot reload; the built app is where this is exercised.
      devOptions: { enabled: false },
    }),
  ],
  server: {
    // Listen on the LAN too, so friends on the same network can join
    host: true,
    port: 5173,
    proxy: {
      '/api': `http://localhost:${backendPort}`,
      '/ws': { target: `ws://localhost:${backendPort}`, ws: true },
    },
  },
  // The service worker only runs in a real build, so `npm run preview` needs the same proxy
  // to be a faithful rehearsal of production.
  preview: {
    port: 4173,
    proxy: {
      '/api': `http://localhost:${backendPort}`,
      '/ws': { target: `ws://localhost:${backendPort}`, ws: true },
    },
  },
})
