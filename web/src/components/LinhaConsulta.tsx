import { memo, useState } from 'react'
import type { Consulta } from '../lib/tipos'
import { abrirLink } from '../lib/plataforma'
import { BarraBalanco } from './BarraBalanco'

interface Props {
  c: Consulta
  /** Só no APK: undefined esconde a estrela. */
  seguida?: boolean
  aoSeguir?: (id: number) => void
}

export const LinhaConsulta = memo(function LinhaConsulta({ c, seguida, aoSeguir }: Props) {
  const [aberta, setAberta] = useState(false)
  const longa = c.ementa.length > 220
  return (
    <li className="linha">
      <div className="linha__texto">
        <div className="linha__cabecalho">
          <h2 className="linha__titulo">{c.titulo}</h2>
          {aoSeguir && (
            <button
              type="button"
              className="estrela"
              aria-pressed={seguida}
              aria-label={`${seguida ? 'Deixar de seguir' : 'Seguir'} ${c.titulo}`}
              onClick={() => aoSeguir(c.id)}
            >
              <span aria-hidden="true">{seguida ? '★' : '☆'}</span>
            </button>
          )}
        </div>
        <p className={`linha__ementa${aberta ? '' : ' linha__ementa--curta'}`}>{c.ementa}</p>
        {longa && (
          <button
            type="button"
            className="link-botao"
            aria-expanded={aberta}
            onClick={() => setAberta(!aberta)}
          >
            {aberta ? 'Ver menos' : 'Ver mais'}
          </button>
        )}
      </div>
      <div className="linha__votos">
        <BarraBalanco c={c} />
        <a
          className="votar"
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.preventDefault()
            abrirLink(c.url)
          }}
        >
          Votar no Senado <span aria-hidden="true">↗</span>
        </a>
      </div>
    </li>
  )
})
