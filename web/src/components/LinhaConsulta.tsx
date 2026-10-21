import { memo, useState } from 'react'
import type { Consulta } from '../lib/tipos'
import { BarraBalanco } from './BarraBalanco'

export const LinhaConsulta = memo(function LinhaConsulta({ c }: { c: Consulta }) {
  const [aberta, setAberta] = useState(false)
  const longa = c.ementa.length > 220
  return (
    <li className="linha">
      <div className="linha__texto">
        <h2 className="linha__titulo">{c.titulo}</h2>
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
        <a className="votar" href={c.url} target="_blank" rel="noopener noreferrer">
          Votar no Senado <span aria-hidden="true">↗</span>
        </a>
      </div>
    </li>
  )
})
