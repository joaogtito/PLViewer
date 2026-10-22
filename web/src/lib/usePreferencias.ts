import { useCallback, useEffect, useRef, useState } from 'react'
import { aplicar, carregarPreferencias, gravarPreferencias } from './notificacoes'
import { MAX_SEGUIDAS, type EventoNotif, type Preferencias } from './topicos'

const AVISOS = {
  negado: 'Permissão negada. Ative as notificações do app nas configurações do Android.',
  erro: 'Não foi possível atualizar as notificações. Tente de novo.',
  limite: `Você pode seguir até ${MAX_SEGUIDAS} consultas.`,
}

export function usePreferencias() {
  const [prefs, setPrefs] = useState<Preferencias>(carregarPreferencias)
  const [aviso, setAviso] = useState<string | null>(null)
  const fila = useRef<Promise<unknown>>(Promise.resolve())
  const atual = useRef(prefs)

  // Aplica em fila: toques rápidos não podem inscrever e cancelar o mesmo tópico em paralelo.
  const mudar = useCallback((proximo: Preferencias) => {
    atual.current = proximo
    setPrefs(proximo)
    gravarPreferencias(proximo)
    fila.current = fila.current
      .then(() => aplicar(proximo))
      .then((r) => setAviso(r === 'ok' ? null : AVISOS[r]))
  }, [])

  // Reaplica ao abrir, caso uma tentativa anterior tenha parado no meio.
  useEffect(() => mudar(atual.current), [mudar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 6000)
    return () => clearTimeout(t)
  }, [aviso])

  const alternarTipo = useCallback(
    (tipo: string) => {
      const p = atual.current
      mudar({ ...p, tipos: p.tipos.includes(tipo) ? p.tipos.filter((t) => t !== tipo) : [...p.tipos, tipo] })
    },
    [mudar],
  )

  const alternarEvento = useCallback(
    (e: EventoNotif) => {
      const p = atual.current
      mudar({ ...p, eventos: { ...p.eventos, [e]: !p.eventos[e] } })
    },
    [mudar],
  )

  const alternarSeguida = useCallback(
    (id: number) => {
      const p = atual.current
      if (p.seguidas.includes(id)) return mudar({ ...p, seguidas: p.seguidas.filter((i) => i !== id) })
      if (p.seguidas.length >= MAX_SEGUIDAS) return setAviso(AVISOS.limite)
      mudar({ ...p, seguidas: [...p.seguidas, id] })
    },
    [mudar],
  )

  const limparSeguidas = useCallback(() => mudar({ ...atual.current, seguidas: [] }), [mudar])

  return { prefs, aviso, alternarTipo, alternarEvento, alternarSeguida, limparSeguidas }
}
