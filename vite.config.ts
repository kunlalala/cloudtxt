import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the app from /cloudtxt/
const base = '/cloudtxt/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    svelte(),
    VitePWA({
      // "prompt": a new version waits until the user taps "Update", so a reload never interrupts typing
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'cloudtxt',
        short_name: 'cloudtxt',
        description: 'Personal notes, fast like Notepad',
        id: base,
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#1e2127',
        theme_color: '#252a32',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // every built file is cached on install, so the whole app opens offline
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        // the first install also controls the already-open tab, so a later update prompt can reload it
        clientsClaim: true,
      },
    }),
  ],
})
