import { describe, expect, it } from 'vitest'
import { filtrar, indexar, type Filtros } from './busca'
import { completar } from './dados'
import { formatarPct, haQuanto } from './formato'
import type { Consulta } from './tipos'

const c = (id: number, sigla: string, ano: number, sim: number, nao: number, ementa = 'Educação básica'): Consulta => ({
  id, sigla, numero: id, ano, titulo: `${sigla} ${id}/${ano}`, ementa,
  votos_sim: sim, votos_nao: nao, votos_total: sim + nao,
  pct_sim: sim + nao ? (sim * 100) / (sim + nao) : null, url: '',
})

const itens = indexar([
  c(1, 'PL', 2024, 5000, 5000),
  c(2, 'PEC', 2022, 9000, 1000),
  c(3, 'PL', 2023, 0, 0),
  c(4, 'PL', 2023, 10, 0),
  c(5, 'PEC', 2022, 100, 1900, 'Segurança pública'),
])
const base: Filtros = { termo: '', tipo: null, ano: null, incluirSemVotos: false, ordem: 'mais-votos' }
const ids = (f: Partial<Filtros>) => filtrar(itens, { ...base, ...f }).map((x) => x.id)

describe('filtrar', () => {
  it('esconde sem votos por padrão e mostra com o toggle', () => {
    expect(ids({})).toEqual([2, 1, 5, 4])
    expect(ids({ incluirSemVotos: true })).toContain(3)
  })
  it('busca sem acento, todos os termos', () => {
    expect(ids({ termo: 'educacao' })).toEqual([2, 1, 4])
    expect(ids({ termo: 'pec 2/2022' })).toEqual([2])
    expect(ids({ termo: 'pec 5/2022' })).toEqual([5])
  })
  it('tipo case-insensitive e ano', () => {
    expect(ids({ tipo: 'pec' })).toEqual([2, 5])
    expect(ids({ ano: 2023 })).toEqual([4])
  })
  it('rankings exigem 1.000 votos', () => {
    expect(ids({ ordem: 'disputadas' })).toEqual([1, 2, 5])
    expect(ids({ ordem: 'apoiadas' })).toEqual([2, 1, 5])
    expect(ids({ ordem: 'rejeitadas' })).toEqual([5, 1, 2])
  })
  it('menos votos', () => {
    expect(ids({ ordem: 'menos-votos' })).toEqual([4, 5, 2, 1])
  })
})

describe('formato', () => {
  it('porcentagens', () => {
    expect(formatarPct(0.3)).toBe('<1%')
    expect(formatarPct(99.6)).toBe('>99%')
    expect(formatarPct(97.16)).toBe('97%')
    expect(formatarPct(0)).toBe('0%')
    expect(formatarPct(100)).toBe('100%')
  })
  it('há quanto tempo', () => {
    const t = Date.parse('2026-10-19T12:00:00Z')
    expect(haQuanto('2026-10-19T11:57:00Z', t)).toBe('há 3 min')
    expect(haQuanto('2026-10-19T09:00:00Z', t)).toBe('há 3 h')
  })
})

describe('completar', () => {
  it('recompõe titulo, url, total e pct_sim', () => {
    const r = completar({ id: 137929, sigla: 'PLP', numero: 183, ano: 2019, ementa: 'e', votos_sim: 371616, votos_nao: 10857 })
    expect(r.titulo).toBe('PLP 183/2019')
    expect(r.votos_total).toBe(382473)
    expect(r.pct_sim).toBe(97.16)
    expect(r.url).toBe('https://www12.senado.leg.br/ecidadania/visualizacaomateria?id=137929')
  })
  it('sem votos fica com pct_sim nulo', () => {
    expect(completar({ id: 1, sigla: 'PL', numero: 1, ano: 2024, ementa: '', votos_sim: 0, votos_nao: 0 }).pct_sim).toBeNull()
  })
})
