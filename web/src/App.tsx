import { Consultas } from './components/Consultas'
import { useConsultas } from './lib/dados'

export function App() {
  const { dados, carregando, semConexao, recarregar } = useConsultas()

  return (
    <>
      {dados ? (
        <Consultas dados={dados} semConexao={semConexao} />
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
