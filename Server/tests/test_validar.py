from plviewer.config import Config
from plviewer.crawler import ResultadoRastreio
from plviewer.models import Consulta
from plviewer.validar import validar

CFG = Config()


def consultas(n):
    return [
        Consulta(id=i, sigla="PL", numero=i, ano=2024, ementa="e",
                 votos_sim=1, votos_nao=0, url="u")
        for i in range(n)
    ]


def rastreio(n=100, **kw):
    base = dict(consultas=consultas(n), total_paginas=3, cards_lidos=n)
    return ResultadoRastreio(**{**base, **kw})


def test_aprovado():
    assert validar(rastreio(), 100, CFG) == []


def test_aprovado_sem_json_anterior():
    assert validar(rastreio(), None, CFG) == []


def test_pagina_1_sem_download():
    r = ResultadoRastreio(total_paginas=0, paginas_falhas=[1])
    assert validar(r, 100, CFG) == ["página 1 não pôde ser baixada"]


def test_sem_nenhum_card():
    r = rastreio(0)
    assert any("layout" in m for m in validar(r, None, CFG))


def test_rastreio_incompleto():
    r = rastreio(paginas_falhas=[2])
    assert any("incompleto" in m for m in validar(r, None, CFG))


def test_total_muito_menor_que_o_anterior():
    assert any("anterior" in m for m in validar(rastreio(40), 100, CFG))
    assert validar(rastreio(50), 100, CFG) == []


def test_muitos_erros_de_parse():
    r = rastreio(100, cards_lidos=102, erros_parse=2)
    assert any("parse" in m for m in validar(r, None, CFG))
    ok = rastreio(100, cards_lidos=101, erros_parse=1)
    assert validar(ok, None, CFG) == []
