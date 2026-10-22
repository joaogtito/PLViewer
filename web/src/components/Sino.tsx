import { useEffect, useRef, useState } from 'react'

/** Sino de contorno. Desativado: risco diagonal desenhado por cima. Ao ativar o risco some e o sino balança. */
export function Sino({ ativo }: { ativo: boolean }) {
  const anterior = useRef(ativo)
  const [balancando, setBalancando] = useState(false)

  useEffect(() => {
    // Só anima quando o estado muda, não na primeira renderização.
    if (anterior.current !== ativo && ativo) setBalancando(true)
    anterior.current = ativo
  }, [ativo])

  return (
    <svg
      className={`sino__icone${ativo ? ' sino__icone--ativo' : ''}${balancando ? ' sino__icone--balanca' : ''}`}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      onAnimationEnd={() => setBalancando(false)}
    >
      <g className="sino__corpo">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </g>
      <path className="sino__risco" d="M4 3.5l16.5 17" pathLength={1} />
    </svg>
  )
}
