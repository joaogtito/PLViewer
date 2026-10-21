import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

/** Roda dentro do APK (Capacitor) e não no navegador/PWA. */
export const nativo = Capacitor.isNativePlatform()

/** Abre um link externo: aba in-app no APK, nova aba na web. */
export function abrirLink(url: string): void {
  if (nativo) void Browser.open({ url })
  else window.open(url, '_blank', 'noopener,noreferrer')
}

export function configurarBarraDeStatus(): void {
  if (!nativo) return
  // Esconde a barra de status do sistema para liberar a tela ao rolar a lista.
  // Estilo escuro fica definido caso o usuário puxe a barra (deslizar da borda superior).
  void StatusBar.setStyle({ style: Style.Dark })
    .then(() => StatusBar.hide())
    .catch(() => {})
}

/**
 * Botão voltar do Android. `aoVoltar` devolve true se tratou o evento (ex.: limpou filtros);
 * caso contrário o app fecha. Retorna a função que remove o ouvinte.
 */
export function aoVoltar(tratar: () => boolean): () => void {
  if (!nativo) return () => {}
  const registro = App.addListener('backButton', () => {
    if (!tratar()) void App.exitApp()
  })
  return () => void registro.then((r) => r.remove())
}
