import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/fitting-assembly/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      scope: '/fitting-assembly/',
      includeAssets: ['apple-touch-icon.png'],
      workbox: {
        navigateFallback: '/fitting-assembly/index.html',
        navigateFallbackAllowlist: [/^\/fitting-assembly/],
      },
      manifest: {
        name: 'Fitting Assembly',
        short_name: 'Assembly',
        description: 'Daily fitting assembly production & component stock',
        theme_color: '#0f766e',
        background_color: '#f1f5f9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/fitting-assembly/',
        scope: '/fitting-assembly/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
