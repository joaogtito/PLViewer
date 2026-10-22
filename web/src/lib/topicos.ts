// Preferências de notificação e os tópicos do FCM que elas viram.
// O contrato de nomes é o mesmo de Server/src/plviewer/notificar.py:
//   t-<SIGLA>-<evento>   tipo de proposição
//   c-<id>-<evento>      consulta seguida (só marco e virada)

export type EventoNotif = 'nova' | 'marco' | 'virada'

export const EVENTOS: { valor: EventoNotif; rotulo: string; dica: string }[] = [
  { valor: 'nova', rotulo: 'Nova consulta', dica: 'Quando aparece uma consulta nova do tipo escolhido.' },
  { valor: 'marco', rotulo: 'Marco de votos', dica: 'Ao passar de 1 mil, 10 mil, 50 mil, 100 mil, 500 mil ou 1 milhão.' },
  { valor: 'virada', rotulo: 'Virada de resultado', dica: 'Quando o lado com mais votos muda.' },
]

/** Teto de consultas seguidas, para ficar longe do limite de tópicos por aparelho do FCM. */
export const MAX_SEGUIDAS = 200

export interface Preferencias {
  tipos: string[]
  eventos: Record<EventoNotif, boolean>
  seguidas: number[]
}

export const PREFERENCIAS_VAZIAS: Preferencias = {
  tipos: [],
  eventos: { nova: true, marco: true, virada: true },
  seguidas: [],
}

/** Tópico do FCM só aceita [a-zA-Z0-9-_.~%]. */
function seguro(sigla: string): string {
  return sigla.replace(/[^A-Za-z0-9_.~%-]/gu, '_')
}

export function topicosDesejados(p: Preferencias): Set<string> {
  const topicos = new Set<string>()
  for (const e of EVENTOS) {
    if (!p.eventos[e.valor]) continue
    for (const tipo of p.tipos) topicos.add(`t-${seguro(tipo)}-${e.valor}`)
    if (e.valor !== 'nova') for (const id of p.seguidas) topicos.add(`c-${id}-${e.valor}`)
  }
  return topicos
}

export function diferenca(atual: Set<string>, desejado: Set<string>) {
  return {
    inscrever: [...desejado].filter((t) => !atual.has(t)),
    cancelar: [...atual].filter((t) => !desejado.has(t)),
  }
}

/** Há alguma coisa para notificar com as preferências atuais? */
export function temAlgo(p: Preferencias): boolean {
  return topicosDesejados(p).size > 0
}

/** Lê o que veio do armazenamento sem confiar no formato. */
export function lerPreferencias(texto: string | null): Preferencias {
  if (!texto) return PREFERENCIAS_VAZIAS
  try {
    const o = JSON.parse(texto) as Partial<Preferencias>
    return {
      tipos: Array.isArray(o.tipos) ? o.tipos.filter((t) => typeof t === 'string') : [],
      eventos: {
        nova: o.eventos?.nova !== false,
        marco: o.eventos?.marco !== false,
        virada: o.eventos?.virada !== false,
      },
      seguidas: Array.isArray(o.seguidas)
        ? o.seguidas.filter((i) => Number.isInteger(i)).slice(0, MAX_SEGUIDAS)
        : [],
    }
  } catch {
    return PREFERENCIAS_VAZIAS
  }
}
