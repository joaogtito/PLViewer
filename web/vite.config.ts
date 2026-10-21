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
        icons: [{ src: 'icone.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      // Só os arquivos do app; o JSON de dados é cacheado em IndexedDB (lib/dados.ts).
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'] },
    }),
  ],
})
