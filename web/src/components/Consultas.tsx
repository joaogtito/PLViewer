import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dados, Ordem } from '../lib/tipos'
import { filtrar, indexar, MIN_VOTOS_RANKING, ORDENS_RANKING } from '../lib/busca'
import { formatarNumero, haQuanto, nomeTipo } from '../lib/formato'
import type { Destino } from '../lib/notificacoes'
import { aoVoltar, nativo } from '../lib/plataforma'
import { temAlgo } from '../lib/topicos'
import { usePreferencias } from '../lib/usePreferencias'
import { LinhaConsulta } from './LinhaConsulta'
import { PainelNotificacoes } from './PainelNotificacoes'
import { Sino } from './Sino'

const PASSO = 30

const ORDENS: { valor: Ordem; rotulo: string }[] = [
  { valor: 'mais-votos', rotulo: 'Mais votos' },
  { valor: 'menos-votos', rotulo: 'Menos votos' },
  { valor: 'disputadas', rotulo: 'Mais disputadas' },
  { valor: 'apoiadas', rotulo: 'Mais apoiadas' },
  { valor: 'rejeitadas', rotulo: 'Mais rejeitadas' },
]

function useDebounce<T>(valor: T, ms: number): T {
  const [v, setV] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return v
}

/** `n` muda a cada toque numa notificação, para reaplicar mesmo com o mesmo destino. */
export type DestinoAberto = Destino & { n: number }

export function Consultas({
  dados,
  semConexao,
  destino,
}: {
  dados: Dados
  semConexao: boolean
  destino: DestinoAberto | null
}) {
  const itens = useMemo(() => indexar(dados.itens), [dados])
  const [entrada, setEntrada] = useState('')
  const termo = useDebounce(entrada, 300)
  const [tipo, setTipo] = useState<string | null>(null)
  const [ano, setAno] = useState<number | null>(null)
  const [incluirSemVotos, setIncluirSemVotos] = useState(false)
  const [ordem, setOrdem] = useState<Ordem>('mais-votos')
  const [visiveis, setVisiveis] = useState(PASSO)
  const [agora, setAgora] = useState(Date.now())
  const [painelAberto, setPainelAberto] = useState(false)
  const notif = usePreferencias()
  // Sombra da barra de filtros só quando ela está colada no topo: observa uma sentinela logo acima dela.
  const sentinela = useRef<HTMLDivElement>(null)
  const [fixa, setFixa] = useState(false)
  useEffect(() => {
    const el = sentinela.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(([e]) => setFixa(!e.isIntersecting && e.boundingClientRect.top < 0))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  const porId = useMemo(() => new Map(itens.map((c) => [c.id, c])), [itens])
  const seguidas = useMemo(() => new Set(notif.prefs.seguidas), [notif.prefs.seguidas])

  // Toque numa notificação: busca pelo título (individual) ou filtro por tipo (resumo).
  // Inclui consultas sem votos, porque uma consulta nova ainda não tem nenhum.
  useEffect(() => {
    if (!destino) return
    setEntrada(destino.busca ?? '')
    setTipo(destino.tipo ?? null)
    setAno(null)
    setIncluirSemVotos(true)
    setPainelAberto(false)
    window.scrollTo({ top: 0 })
  }, [destino])

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const tipos = useMemo(() => {
    const cont = new Map<string, number>()
    for (const c of itens) cont.set(c.sigla, (cont.get(c.sigla) ?? 0) + 1)
    return [...cont.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s)
  }, [itens])
  const anos = useMemo(() => [...new Set(itens.map((c) => c.ano))].sort((a, b) => b - a), [itens])

  const lista = useMemo(
    () => filtrar(itens, { termo, tipo, ano, incluirSemVotos, ordem }),
    [itens, termo, tipo, ano, incluirSemVotos, ordem],
  )
  useEffect(() => setVisiveis(PASSO), [termo, tipo, ano, incluirSemVotos, ordem])

  const baseContagem = incluirSemVotos ? itens.length : itens.filter((c) => c.votos_total > 0).length
  const filtrosAtivos = termo !== '' || tipo !== null || ano !== null
  const limpar = () => {
    setEntrada('')
    setTipo(null)
    setAno(null)
  }

  // Botão voltar do Android: primeiro limpa os filtros; sem filtros, fecha o app.
  const limparRef = useRef(limpar)
  const ativosRef = useRef(filtrosAtivos)
  const painelRef = useRef(painelAberto)
  limparRef.current = limpar
  ativosRef.current = filtrosAtivos
  painelRef.current = painelAberto
  useEffect(
    () =>
      aoVoltar(() => {
        if (painelRef.current) {
          setPainelAberto(false)
          return true
        }
        if (!ativosRef.current) return false
        limparRef.current()
        return true
      }),
    [],
  )

  return (
    <>
      <header className="topo">
        <div className="contido">
          {nativo && (
            <button
              type="button"
              className="sino"
              aria-label={temAlgo(notif.prefs) ? 'Notificações (ativas)' : 'Notificações'}
              onClick={() => setPainelAberto(true)}
            >
              <Sino ativo={temAlgo(notif.prefs)} />
            </button>
          )}
          <h1>Consultas públicas do Senado</h1>
          <p>
            {formatarNumero(baseContagem)} proposições {incluirSemVotos ? '' : 'com votos'}. Dados do
            e-Cidadania, atualizados {haQuanto(dados.atualizado_em, agora)}.
          </p>
        </div>
      </header>

      {painelAberto && (
        <PainelNotificacoes
          prefs={notif.prefs}
          tipos={tipos}
          itens={porId}
          aviso={notif.aviso}
          aoAlternarTipo={notif.alternarTipo}
          aoAlternarEvento={notif.alternarEvento}
          aoDeixarDeSeguir={notif.alternarSeguida}
          aoLimparSeguidas={notif.limparSeguidas}
          aoFechar={() => setPainelAberto(false)}
        />
      )}

      {!painelAberto && notif.aviso && (
        <div className="aviso" role="status">
          {notif.aviso}
        </div>
      )}

      {semConexao && (
        <div className="aviso" role="status">
          Sem conexão. Mostrando dados {haQuanto(dados.atualizado_em, agora)}.
        </div>
      )}

      <div ref={sentinela} className="filtros__sentinela" aria-hidden="true" />
      <div className={`filtros${fixa ? ' filtros--fixa' : ''}`}>
        <div className="contido">
          <input
            type="search"
            className="busca"
            placeholder="Buscar por tema, número ou ementa (ex.: pec 2/2022)"
            aria-label="Buscar"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
          />
          <div className="chips" role="group" aria-label="Tipo de proposição">
            <button type="button" className="chip" aria-pressed={tipo === null} onClick={() => setTipo(null)}>
              Todos
            </button>
            {tipos.map((t) => (
              <button
                key={t}
                type="button"
                className="chip"
                aria-pressed={tipo === t}
                onClick={() => setTipo(tipo === t ? null : t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tipo && <p className="dica">{nomeTipo(tipo)}</p>}
          <div className="linha-controles">
            <label>
              Ano
              <select value={ano ?? ''} onChange={(e) => setAno(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Todos</option>
                {anos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ordenar por
              <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}>
                {ORDENS.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </select>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={incluirSemVotos}
                onChange={(e) => setIncluirSemVotos(e.target.checked)}
              />
              Incluir sem votos
            </label>
          </div>
          {ORDENS_RANKING.includes(ordem) && (
            <p className="dica">Considera só consultas com {formatarNumero(MIN_VOTOS_RANKING)} votos ou mais.</p>
          )}
        </div>
      </div>

      <main className="contido">
        {lista.length === 0 ? (
          <div className="vazio">
            <p>Nenhuma proposição encontrada. Tente outro termo ou remova os filtros.</p>
            {filtrosAtivos && (
              <button type="button" className="botao" onClick={limpar}>
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="contagem" aria-live="polite">
              {formatarNumero(lista.length)} {lista.length === 1 ? 'resultado' : 'resultados'}
            </p>
            <ul className="lista">
              {lista.slice(0, visiveis).map((c) => (
                <LinhaConsulta
                  key={c.id}
                  c={c}
                  seguida={nativo ? seguidas.has(c.id) : undefined}
                  aoSeguir={nativo ? notif.alternarSeguida : undefined}
                />
              ))}
            </ul>
            {visiveis < lista.length && (
              <button type="button" className="botao botao--mais" onClick={() => setVisiveis(visiveis + PASSO)}>
                Mostrar mais
              </button>
            )}
          </>
        )}
      </main>
    </>
  )
}
