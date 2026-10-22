import { FirebaseMessaging, Importance } from '@capacitor-firebase/messaging'
import { nativo } from './plataforma'
import {
  diferenca,
  lerPreferencias,
  temAlgo,
  topicosDesejados,
  type Preferencias,
} from './topicos'

const CHAVE_PREFS = 'plviewer.notificacoes'
const CHAVE_TOPICOS = 'plviewer.topicos'
export const CANAL = 'consultas' // o mesmo de default_notification_channel_id no AndroidManifest

/** Onde o toque na notificação leva: busca por título (individual) ou filtro por tipo (resumo). */
export interface Destino {
  busca?: string
  tipo?: string
}

export type Resultado = 'ok' | 'negado' | 'erro'

function ler(chave: string): string | null {
  try {
    return localStorage.getItem(chave)
  } catch {
    return null
  }
}

function gravar(chave: string, valor: string): void {
  try {
    localStorage.setItem(chave, valor)
  } catch {
    /* sem armazenamento: as preferências valem só nesta sessão */
  }
}

export const carregarPreferencias = (): Preferencias => lerPreferencias(ler(CHAVE_PREFS))

export function gravarPreferencias(p: Preferencias): void {
  gravar(CHAVE_PREFS, JSON.stringify(p))
}

function inscritos(): Set<string> {
  try {
    return new Set(JSON.parse(ler(CHAVE_TOPICOS) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

async function permitido(): Promise<boolean> {
  const atual = await FirebaseMessaging.checkPermissions()
  if (atual.receive === 'granted') return true
  if (atual.receive === 'denied') return false
  return (await FirebaseMessaging.requestPermissions()).receive === 'granted'
}

/** Cria o canal Android das notificações. Chamado uma vez ao abrir o app. */
export async function prepararNotificacoes(): Promise<void> {
  if (!nativo) return
  try {
    await FirebaseMessaging.createChannel({
      id: CANAL,
      name: 'Consultas',
      description: 'Consultas novas, marcos de votos e viradas de resultado',
      importance: Importance.High,
    })
  } catch {
    /* sem google-services.json (build local sem Firebase) */
  }
}

/** Faz os tópicos do FCM refletirem as preferências. Pede a permissão só quando há o que assinar. */
export async function aplicar(p: Preferencias): Promise<Resultado> {
  if (!nativo) return 'ok'
  try {
    const desejado = topicosDesejados(p)
    if (temAlgo(p) && !(await permitido())) return 'negado'
    const atual = inscritos()
    const { inscrever, cancelar } = diferenca(atual, desejado)
    for (const topic of cancelar) {
      await FirebaseMessaging.unsubscribeFromTopic({ topic })
      atual.delete(topic)
      gravar(CHAVE_TOPICOS, JSON.stringify([...atual]))
    }
    for (const topic of inscrever) {
      await FirebaseMessaging.subscribeToTopic({ topic })
      atual.add(topic)
      gravar(CHAVE_TOPICOS, JSON.stringify([...atual]))
    }
    return 'ok'
  } catch {
    return 'erro'
  }
}

/** Chama `aoAbrir` quando o usuário toca numa notificação. Retorna a função que remove o ouvinte. */
export function aoTocarNotificacao(aoAbrir: (d: Destino) => void): () => void {
  if (!nativo) return () => {}
  const registro = FirebaseMessaging.addListener('notificationActionPerformed', (e) => {
    const dados = (e.notification.data ?? {}) as Record<string, unknown>
    const busca = typeof dados.busca === 'string' ? dados.busca : undefined
    const tipo = typeof dados.tipo === 'string' ? dados.tipo : undefined
    if (busca || tipo) aoAbrir({ busca, tipo })
  })
  return () => void registro.then((r) => r.remove())
}
