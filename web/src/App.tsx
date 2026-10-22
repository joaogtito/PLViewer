import { useEffect, useState } from 'react'
import { Consultas, type DestinoAberto } from './components/Consultas'
import { useConsultas } from './lib/dados'
import { aoTocarNotificacao, prepararNotificacoes } from './lib/notificacoes'

export function App() {
  const { dados, carregando, semConexao, recarregar } = useConsultas()
  const [destino, setDestino] = useState<DestinoAberto | null>(null)

  // Fica no App (e não em Consultas) para não perder o toque que abriu o app antes dos dados chegarem.
  useEffect(() => {
    void prepararNotificacoes()
    return aoTocarNotificacao((d) => setDestino((a) => ({ ...d, n: (a?.n ?? 0) + 1 })))
  }, [])

  return (
    <>
      {dados ? (
        <Consultas dados={dados} semConexao={semConexao} destino={destino} />
      ) : carregando ? (
        <div className="contido estado" aria-busy="true">
          <div className="esqueleto" />
          <div className="esqueleto" />
          <div className="esqueleto" />
        </div>
      ) : (
        <div className="contido estado">
          <p>Não foi possível carregar os dados. Verifique a conexão e tente de novo.</p>
          <button type="button" className="botao" onClick={() => void recarregar()}>
            Tentar de novo
          </button>
        </div>
      )}
      <footer className="rodape contido">
        App independente, sem vínculo com o Senado Federal. Os dados vêm do portal e-Cidadania e o voto é
        registrado no site oficial, com login gov.br.
      </footer>
    </>
  )
}
