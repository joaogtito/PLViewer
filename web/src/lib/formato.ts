const nf = new Intl.NumberFormat('pt-BR')

export const formatarNumero = (n: number) => nf.format(n)

/** Arredonda; entre 0 e 1 vira "<1%", entre 99 e 100 vira ">99%". */
export function formatarPct(pct: number): string {
  if (pct > 0 && pct < 1) return '<1%'
  if (pct > 99 && pct < 100) return '>99%'
  return `${Math.round(pct)}%`
}

export function haQuanto(iso: string, agora = Date.now()): string {
  const min = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'agora há pouco'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`
}

export const NOMES_TIPO: Record<string, string> = {
  PL: 'Projeto de lei',
  PLP: 'Projeto de lei complementar',
  PLC: 'Projeto de lei da Câmara',
  PLS: 'Projeto de lei do Senado',
  PLV: 'Projeto de lei de conversão',
  PEC: 'Proposta de emenda à Constituição',
  PDL: 'Projeto de decreto legislativo',
  PDS: 'Projeto de decreto legislativo (Senado)',
  PRS: 'Projeto de resolução do Senado',
  MPV: 'Medida provisória',
  SUG: 'Sugestão legislativa',
  SCD: 'Substitutivo da Câmara a projeto do Senado',
}

export const nomeTipo = (sigla: string) => NOMES_TIPO[sigla.toUpperCase()] ?? sigla
