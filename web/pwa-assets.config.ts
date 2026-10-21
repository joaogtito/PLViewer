import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// npm run icones: gera os PNGs a partir de public/icone.svg. Os PNGs são commitados.
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/icone.svg'],
})
