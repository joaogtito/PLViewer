import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base relativa: o mesmo build serve no Pages (subpasta), no Capacitor e no Electron (file://).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Consultas Públicas do Senado',
        short_name: 'Consultas',
        description: 'Acompanhe os votos das consultas públicas do e-Cidadania.',
        lang: 'pt-BR',
        theme_color: '#0b3d78',
        background_color: '#f2f5f9',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Só os arquivos do app; o JSON de dados é cacheado em IndexedDB (lib/dados.ts).
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'] },
    }),
  ],
})
