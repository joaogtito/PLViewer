import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/archivo'
import '@fontsource-variable/source-serif-4'
import './styles.css'
import { App } from './App'
import { configurarBarraDeStatus } from './lib/plataforma'

configurarBarraDeStatus()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
