import { useEffect, useRef } from 'react'
import type { Consulta } from '../lib/tipos'
import { EVENTOS, MAX_SEGUIDAS, type EventoNotif, type Preferencias } from '../lib/topicos'

interface Props {
  prefs: Preferencias
  /** Siglas existentes nos dados, da mais frequente para a menos. */
  tipos: string[]
  itens: Map<number, Consulta>
  aviso: string | null
  aoAlternarTipo: (tipo: string) => void
  aoAlternarEvento: (e: EventoNotif) => void
  aoDeixarDeSeguir: (id: number) => void
  aoLimparSeguidas: () => void
  aoFechar: () => void
}

export function PainelNotificacoes(p: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog ref={ref} className="painel" aria-labelledby="painel-titulo" onClose={p.aoFechar}>
      <div className="painel__cabecalho">
        <h2 id="painel-titulo">Notificações</h2>
        <button type="button" className="link-botao" onClick={() => ref.current?.close()}>
          Fechar
        </button>
      </div>

      {p.aviso && (
        <div className="aviso aviso--painel" role="status">
          {p.aviso}
        </div>
      )}

      <section>
        <h3>Tipos de proposição</h3>
        <p className="dica">Avisa sobre todas as consultas dos tipos marcados.</p>
        <div className="chips" role="group" aria-label="Tipos para notificar">
          {p.tipos.map((t) => (
            <button
              key={t}
              type="button"
              className="chip"
              aria-pressed={p.prefs.tipos.includes(t)}
              onClick={() => p.aoAlternarTipo(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Avisar quando</h3>
        {EVENTOS.map((e) => (
          <label key={e.valor} className="evento">
            <input
              type="checkbox"
              checked={p.prefs.eventos[e.valor]}
              onChange={() => p.aoAlternarEvento(e.valor)}
            />
            <span>
              {e.rotulo}
              <small>{e.dica}</small>
            </span>
          </label>
        ))}
      </section>

      <section>
        <h3>
          Consultas seguidas ({p.prefs.seguidas.length}/{MAX_SEGUIDAS})
        </h3>
        <p className="dica">
          Toque na estrela de uma consulta para seguir. Você recebe marcos de votos e viradas, mesmo que o
          tipo dela não esteja marcado.
        </p>
        {p.prefs.seguidas.length > 0 && (
          <>
            <ul className="seguidas">
              {p.prefs.seguidas.map((id) => (
                <li key={id}>
                  <span>{p.itens.get(id)?.titulo ?? `Consulta ${id}`}</span>
                  <button type="button" className="link-botao" onClick={() => p.aoDeixarDeSeguir(id)}>
                    Deixar de seguir
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="link-botao" onClick={p.aoLimparSeguidas}>
              Deixar de seguir todas
            </button>
          </>
        )}
      </section>
    </dialog>
  )
}
