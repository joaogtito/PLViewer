import type { Consulta, ConsultaIndexada, Ordem } from './tipos'

export const MIN_VOTOS_RANKING = 1000

export function normalizar(texto: string): string {
  return texto
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function indexar(itens: Consulta[]): ConsultaIndexada[] {
  return itens.map((c) => ({ ...c, busca: normalizar(`${c.titulo} ${c.ementa}`) }))
}

export interface Filtros {
  termo: string
  tipo: string | null
  ano: number | null
  incluirSemVotos: boolean
  ordem: Ordem
}

export const ORDENS_RANKING: Ordem[] = ['disputadas', 'apoiadas', 'rejeitadas']

const comparadores: Record<Ordem, (a: ConsultaIndexada, b: ConsultaIndexada) => number> = {
  'mais-votos': (a, b) => b.votos_total - a.votos_total || b.id - a.id,
  'menos-votos': (a, b) => a.votos_total - b.votos_total || b.id - a.id,
  disputadas: (a, b) => Math.abs(a.pct_sim! - 50) - Math.abs(b.pct_sim! - 50),
  apoiadas: (a, b) => b.pct_sim! - a.pct_sim!,
  rejeitadas: (a, b) => a.pct_sim! - b.pct_sim!,
}

export function filtrar(itens: ConsultaIndexada[], f: Filtros): ConsultaIndexada[] {
  const termos = normalizar(f.termo).split(/\s+/).filter(Boolean)
  const ranking = ORDENS_RANKING.includes(f.ordem)
  const saida = itens.filter((c) => {
    if (!f.incluirSemVotos && c.votos_total === 0) return false
    if (ranking && c.votos_total < MIN_VOTOS_RANKING) return false
    if (f.tipo && c.sigla.toLowerCase() !== f.tipo.toLowerCase()) return false
    if (f.ano !== null && c.ano !== f.ano) return false
    return termos.every((t) => c.busca.includes(t))
  })
  return saida.sort(comparadores[f.ordem])
}
