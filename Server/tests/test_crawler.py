import httpx

from plviewer.config import Config
from plviewer.crawler import Rastreador


def pagina(ids, total=3, atual=1):
    cards = "".join(
        f'<div class="resumo-materia"><header><a href="v?id={i}">PL {i}/2024</a>'
        f'</header><section><a href="v?id={i}">e</a></section></div>'
        for i in ids
    )
    links = "".join(
        f'<a class="page-link" href="x?p={p}">{p}</a>' for p in range(1, total + 1)
    )
    return f"<html><body>{cards}{links}</body></html>"


class Falso:
    def __init__(self, paginas, falhas=None):
        self.paginas = paginas
        self.falhas = dict(falhas or {})  # pagina -> quantas falhas antes de dar certo
        self.chamadas: list[int] = []

    async def get_pagina(self, n):
        self.chamadas.append(n)
        if self.falhas.get(n, 0) > 0:
            self.falhas[n] -= 1
            raise httpx.ConnectError("boom")
        return self.paginas[n]


async def nao_dorme(_):
    return None


def config(**kw):
    return Config(**{"tentativas": 4, "backoff_s": 1.5, **kw})


async def rastrear(cliente, esperas=None, **kw):
    async def dormir(s):
        if esperas is not None:
            esperas.append(s)

    return await Rastreador(cliente, config(**kw), dormir).rastrear()


PAGINAS = {1: pagina([1, 2]), 2: pagina([3, 4]), 3: pagina([5])}


async def test_rastreia_todas_as_paginas():
    res = await rastrear(Falso(PAGINAS))
    assert res.total_paginas == 3
    assert sorted(c.id for c in res.consultas) == [1, 2, 3, 4, 5]
    assert res.paginas_falhas == []


async def test_deduplica_por_id():
    paginas = {**PAGINAS, 3: pagina([4, 5])}
    res = await rastrear(Falso(paginas))
    assert sorted(c.id for c in res.consultas) == [1, 2, 3, 4, 5]
    assert res.cards_lidos == 6


async def test_retry_com_backoff_exponencial():
    esperas: list[float] = []
    cliente = Falso(PAGINAS, falhas={2: 3})
    res = await rastrear(cliente, esperas, pausa_s=0)
    assert res.paginas_falhas == []
    assert cliente.chamadas.count(2) == 4
    assert [e for e in esperas if e] == [1.5, 3.0, 6.0]


async def test_pagina_que_esgota_tentativas_e_registrada():
    cliente = Falso(PAGINAS, falhas={2: 99})
    res = await rastrear(cliente)
    assert res.paginas_falhas == [2]
    assert cliente.chamadas.count(2) == 4
    assert sorted(c.id for c in res.consultas) == [1, 2, 5]


async def test_falha_na_pagina_1_aborta():
    res = await rastrear(Falso(PAGINAS, falhas={1: 99}))
    assert res.total_paginas == 0
    assert res.paginas_falhas == [1]
    assert res.consultas == []
