import type { Consulta } from '../lib/tipos'
import { formatarNumero, formatarPct } from '../lib/formato'

export function BarraBalanco({ c }: { c: Consulta }) {
  if (c.votos_total === 0 || c.pct_sim === null) {
    return <div className="balanco balanco--vazio">Ainda sem votos</div>
  }
  const nao = 100 - c.pct_sim
  return (
    <div className="balanco">
      <div
        className="balanco__barra"
        role="img"
        aria-label={`${formatarPct(c.pct_sim)} sim, ${formatarPct(nao)} não`}
      >
        <span className="balanco__sim" style={{ width: `${c.pct_sim}%` }} />
        <span className="balanco__marca" />
      </div>
      <div className="balanco__nums">
        <span className="sim">
          SIM <strong>{formatarNumero(c.votos_sim)}</strong> · {formatarPct(c.pct_sim)}
        </span>
        <span className="nao">
          NÃO <strong>{formatarNumero(c.votos_nao)}</strong> · {formatarPct(nao)}
        </span>
      </div>
    </div>
  )
}
