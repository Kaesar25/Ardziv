import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
      },
      manifest: {
        name: 'EUGA Ardziv 2',
        short_name: 'Ardziv 2',
        description: "L'app de l'équipe réserve de l'EUGA Ardziv",
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#0B0B0C',
        theme_color: '#0B0B0C',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
