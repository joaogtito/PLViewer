import re
from dataclasses import dataclass, field

from selectolax.lexbor import LexborHTMLParser, LexborNode

from .models import Consulta

_ID = re.compile(r"[?&]id=(\d+)")
_TITULO = re.compile(r"^([^\W\d_]+)\s+(\d+)\s*/\s*(\d{4})$")
_PAGINA = re.compile(r"[?&]p=(\d+)")


@dataclass
class ResultadoPagina:
    consultas: list[Consulta] = field(default_factory=list)
    erros: int = 0
    total_paginas: int = 1


def _numero(texto: str) -> int:
    return int("".join(c for c in texto if c.isdigit()))


def _parse_card(card: LexborNode, base_url: str) -> Consulta:
    link = card.css_first("header a")
    m_id = _ID.search(link.attributes.get("href") or "")
    m_titulo = _TITULO.match(" ".join(link.text().split()))
    if not m_id or not m_titulo:
        raise ValueError("cabeçalho do card fora do padrão")

    ementa_el = card.css_first("section a")
    ementa = " ".join(ementa_el.text().split()) if ementa_el else ""

    figura = card.css_first("figure.grafico-consulta-publica")
    if figura is None:
        sim = nao = 0
    else:
        spans = figura.css("header span")
        if len(spans) != 2:
            raise ValueError("gráfico sem exatamente 2 valores")
        sim, nao = _numero(spans[0].text()), _numero(spans[1].text())

    id_ = int(m_id.group(1))
    return Consulta(
        id=id_,
        sigla=m_titulo.group(1),
        numero=int(m_titulo.group(2)),
        ano=int(m_titulo.group(3)),
        ementa=ementa,
        votos_sim=sim,
        votos_nao=nao,
        url=f"{base_url}/visualizacaomateria?id={id_}",
    )


def _total_paginas(arvore: LexborHTMLParser) -> int:
    maior = 1
    for a in arvore.css("a.page-link"):
        m = _PAGINA.search(a.attributes.get("href") or "")
        if m:
            maior = max(maior, int(m.group(1)))
    # Na última página o link da página atual pode ser o maior.
    ativo = arvore.css_first("li.page-item.active a.page-link")
    if ativo is not None:
        try:
            maior = max(maior, _numero(ativo.text()))
        except ValueError:
            pass
    return maior


def parse_pagina(html: str, base_url: str) -> ResultadoPagina:
    arvore = LexborHTMLParser(html)
    resultado = ResultadoPagina(total_paginas=_total_paginas(arvore))
    for card in arvore.css("div.resumo-materia"):
        try:
            resultado.consultas.append(_parse_card(card, base_url))
        except (ValueError, AttributeError):
            resultado.erros += 1
    return resultado
