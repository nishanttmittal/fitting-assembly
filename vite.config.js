import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/fitting/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      scope: '/fitting/',
      includeAssets: ['apple-touch-icon.png'],
      workbox: {
        navigateFallback: '/fitting/index.html',
        navigateFallbackAllowlist: [/^\/fitting/],
      },
      manifest: {
        name: 'Fitting',
        short_name: 'Fitting',
        description: 'Daily fitting production & component stock',
        theme_color: '#0f766e',
        background_color: '#f1f5f9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/fitting/',
        scope: '/fitting/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
