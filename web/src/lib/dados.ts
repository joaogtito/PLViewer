import { useCallback, useEffect, useState } from 'react'
import type { ConsultaBruta, Consulta, Dados, DadosBrutos } from './tipos'

const DATA_URL: string = import.meta.env.VITE_DATA_URL
const URL_SENADO = 'https://www12.senado.leg.br/ecidadania/visualizacaomateria?id='
const DB = 'plviewer'
const STORE = 'cache'
const CHAVE = 'consultas'

// Cache em IndexedDB (e não em service worker) para funcionar igual na web, no Capacitor e no Electron.
function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => ok(r.result)
    r.onerror = () => erro(r.error)
  })
}

async function lerCache(): Promise<Dados | null> {
  try {
    const db = await abrir()
    return await new Promise((ok) => {
      const r = db.transaction(STORE).objectStore(STORE).get(CHAVE)
      r.onsuccess = () => ok((r.result as Dados) ?? null)
      r.onerror = () => ok(null)
    })
  } catch {
    return null
  }
}

async function gravarCache(dados: Dados): Promise<void> {
  try {
    const db = await abrir()
    db.transaction(STORE, 'readwrite').objectStore(STORE).put(dados, CHAVE)
  } catch {
    /* cache é só conveniência */
  }
}

/** Recompõe os campos que o scraper não envia (mantém as mesmas regras de models.py). */
export function completar(c: ConsultaBruta): Consulta {
  const total = c.votos_sim + c.votos_nao
  return {
    ...c,
    titulo: `${c.sigla} ${c.numero}/${c.ano}`,
    votos_total: total,
    pct_sim: total === 0 ? null : Math.round((c.votos_sim * 10000) / total) / 100,
    url: URL_SENADO + c.id,
  }
}

async function lerJson(r: Response): Promise<DadosBrutos> {
  const bytes = new Uint8Array(await r.arrayBuffer())
  // Gzip começa com 0x1f 0x8b. Se alguém já descomprimiu no caminho, lê como JSON puro.
  const gzip = bytes[0] === 0x1f && bytes[1] === 0x8b
  const fluxo = gzip
    ? new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
    : new Blob([bytes]).stream()
  return JSON.parse(await new Response(fluxo).text()) as DadosBrutos
}

async function baixar(): Promise<Dados> {
  const r = await fetch(DATA_URL, { cache: 'no-cache' }) // revalida por ETag
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const bruto = await lerJson(r)
  if (!Array.isArray(bruto.itens)) throw new Error('JSON inesperado')
  return { ...bruto, itens: bruto.itens.map(completar) }
}

export interface Estado {
  dados: Dados | null
  carregando: boolean
  /** Falha de rede ao atualizar, com ou sem cache. */
  semConexao: boolean
}

export function useConsultas() {
  const [estado, setEstado] = useState<Estado>({ dados: null, carregando: true, semConexao: false })

  const carregar = useCallback(async () => {
    setEstado((e) => ({ ...e, carregando: e.dados === null, semConexao: false }))
    const emCache = await lerCache()
    if (emCache) setEstado({ dados: emCache, carregando: false, semConexao: false })
    try {
      const novos = await baixar()
      setEstado((e) => {
        // Mantém a referência se nada mudou: evita refiltrar 7.690 itens à toa.
        if (e.dados?.atualizado_em === novos.atualizado_em) return { ...e, carregando: false }
        return { dados: novos, carregando: false, semConexao: false }
      })
      void gravarCache(novos)
    } catch {
      setEstado((e) => ({ ...e, carregando: false, semConexao: true }))
    }
  }, [])

  useEffect(() => {
    void carregar()
    const aoVoltar = () => document.visibilityState === 'visible' && void carregar()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [carregar])

  return { ...estado, recarregar: carregar }
}
