export interface Consulta {
  id: number
  sigla: string
  numero: number
  ano: number
  titulo: string
  ementa: string
  votos_sim: number
  votos_nao: number
  votos_total: number
  pct_sim: number | null
  url: string
}

/** Como o item vem no JSON: só o que não dá para calcular. */
export type ConsultaBruta = Pick<
  Consulta,
  'id' | 'sigla' | 'numero' | 'ano' | 'ementa' | 'votos_sim' | 'votos_nao'
>

export interface DadosBrutos {
  atualizado_em: string
  total: number
  itens: ConsultaBruta[]
}

export interface Dados {
  atualizado_em: string
  total: number
  itens: Consulta[]
}

/** Consulta com o texto de busca já normalizado (calculado ao carregar). */
export interface ConsultaIndexada extends Consulta {
  busca: string
}

export type Ordem = 'mais-votos' | 'menos-votos' | 'disputadas' | 'apoiadas' | 'rejeitadas'
