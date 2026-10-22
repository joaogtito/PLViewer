import { describe, expect, it } from 'vitest'
import {
  diferenca,
  lerPreferencias,
  MAX_SEGUIDAS,
  PREFERENCIAS_VAZIAS,
  temAlgo,
  topicosDesejados,
  type Preferencias,
} from './topicos'

const prefs = (p: Partial<Preferencias>): Preferencias => ({ ...PREFERENCIAS_VAZIAS, ...p })

describe('topicosDesejados', () => {
  it('não assina nada por padrão', () => {
    expect(topicosDesejados(PREFERENCIAS_VAZIAS).size).toBe(0)
    expect(temAlgo(PREFERENCIAS_VAZIAS)).toBe(false)
  })

  it('tipo vira um tópico por evento ligado', () => {
    expect([...topicosDesejados(prefs({ tipos: ['PL'] }))].sort()).toEqual([
      't-PL-marco',
      't-PL-nova',
      't-PL-virada',
    ])
  })

  it('seguida só recebe marco e virada', () => {
    expect([...topicosDesejados(prefs({ seguidas: [137929] }))].sort()).toEqual([
      'c-137929-marco',
      'c-137929-virada',
    ])
  })

  it('evento desligado some de tipos e seguidas', () => {
    const p = prefs({
      tipos: ['PEC'],
      seguidas: [5],
      eventos: { nova: true, marco: false, virada: false },
    })
    expect([...topicosDesejados(p)]).toEqual(['t-PEC-nova'])
  })

  it('sigla fora do alfabeto do FCM vira _ (igual ao servidor)', () => {
    expect(topicosDesejados(prefs({ tipos: ['Ç/X'], eventos: { nova: true, marco: false, virada: false } }))).toEqual(
      new Set(['t-__X-nova']),
    )
  })
})

describe('diferenca', () => {
  it('inscreve o que falta e cancela o que sobra', () => {
    const d = diferenca(new Set(['a', 'b']), new Set(['b', 'c']))
    expect(d).toEqual({ inscrever: ['c'], cancelar: ['a'] })
  })
})

describe('lerPreferencias', () => {
  it('usa o padrão se vazio ou inválido', () => {
    expect(lerPreferencias(null)).toEqual(PREFERENCIAS_VAZIAS)
    expect(lerPreferencias('{não é json')).toEqual(PREFERENCIAS_VAZIAS)
  })

  it('descarta lixo e respeita o limite de seguidas', () => {
    const seguidas = Array.from({ length: MAX_SEGUIDAS + 20 }, (_, i) => i)
    const p = lerPreferencias(
      JSON.stringify({ tipos: ['PL', 3], eventos: { marco: false }, seguidas: [...seguidas, 'x'] }),
    )
    expect(p.tipos).toEqual(['PL'])
    expect(p.eventos).toEqual({ nova: true, marco: false, virada: true })
    expect(p.seguidas).toHaveLength(MAX_SEGUIDAS)
  })
})
