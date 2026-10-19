from pathlib import Path

from plviewer.parser import parse_pagina

FIX = Path(__file__).parent / "fixtures"
BASE = "https://www12.senado.leg.br/ecidadania"


def ler(nome: str) -> str:
    return (FIX / nome).read_text(encoding="utf-8")


def card(titulo="PL 1/2024", href="visualizacaomateria?id=1", ementa="Texto", figura=""):
    return (
        f'<div class="resumo-materia"><header><a href="{href}">{titulo}</a></header>'
        f'<section><a href="{href}">{ementa}</a></section>{figura}</div>'
    )


def figura(*spans):
    s = "".join(f"<span>{x}</span>" for x in spans)
    return (
        '<a href="x"><figure class="grafico-consulta-publica">'
        f"<header>{s}</header></figure></a>"
    )


def test_pagina_com_votos():
    r = parse_pagina(ler("pagina_com_votos.html"), BASE)
    assert r.erros == 0
    assert len(r.consultas) == 3
    assert r.total_paginas == 77
    c = r.consultas[0]
    assert (c.id, c.sigla, c.numero, c.ano) == (160575, "PL", 5064, 2023)
    assert (c.votos_sim, c.votos_nao) == (718140, 1075125)
    assert c.pct_sim == 40.05
    assert c.url == f"{BASE}/visualizacaomateria?id=160575"


def test_ementa_multilinha_vira_uma_linha():
    r = parse_pagina(ler("pagina_com_votos.html"), BASE)
    for c in r.consultas:
        assert "\n" not in c.ementa and "  " not in c.ementa
    assert "Fiscalização da Exploração" in r.consultas[1].ementa


def test_pagina_final_com_cards_sem_grafico():
    r = parse_pagina(ler("pagina_final.html"), BASE)
    assert r.total_paginas == 77
    assert len(r.consultas) == 4
    assert r.consultas[0].votos_total > 0
    for c in r.consultas[1:]:
        assert (c.votos_sim, c.votos_nao, c.votos_total) == (0, 0, 0)
        assert c.pct_sim is None


def test_separador_de_milhar():
    html = card(figura="".join([figura("1.234.567", "89")]))
    c = parse_pagina(html, BASE).consultas[0]
    assert (c.votos_sim, c.votos_nao) == (1234567, 89)


def test_card_quebrado_e_descartado_sem_derrubar_a_pagina():
    html = (
        card(titulo="sem numero")
        + card(figura=figura("1", "2", "3"))
        + card(href="visualizacaomateria?id=7", titulo="PEC 2/2022")
    )
    r = parse_pagina(html, BASE)
    assert r.erros == 2
    assert [c.id for c in r.consultas] == [7]


def test_html_sem_cards():
    r = parse_pagina("<html><body><p>oi</p></body></html>", BASE)
    assert r.consultas == [] and r.erros == 0 and r.total_paginas == 1
