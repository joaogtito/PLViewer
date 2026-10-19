import asyncio
from dataclasses import dataclass, field
from typing import Protocol

import httpx

from .config import Config
from .models import Consulta
from .parser import parse_pagina


class Cliente(Protocol):
    async def get_pagina(self, pagina: int) -> str: ...


class HttpCliente:
    def __init__(self, config: Config):
        self._url = f"{config.base_url}/pesquisamateria"
        self._http = httpx.AsyncClient(
            headers={"User-Agent": config.user_agent},
            timeout=config.timeout_s,
            follow_redirects=True,
        )

    async def get_pagina(self, pagina: int) -> str:
        r = await self._http.get(self._url, params={"p": pagina})
        r.raise_for_status()
        return r.text

    async def aclose(self) -> None:
        await self._http.aclose()


@dataclass
class ResultadoRastreio:
    consultas: list[Consulta] = field(default_factory=list)
    total_paginas: int = 0
    paginas_falhas: list[int] = field(default_factory=list)
    erros_parse: int = 0
    cards_lidos: int = 0  # cards vistos, com e sem erro (antes do dedup)


class Rastreador:
    def __init__(self, cliente: Cliente, config: Config, dormir=asyncio.sleep):
        self._cliente = cliente
        self._config = config
        self._dormir = dormir

    async def _baixar(self, pagina: int) -> str:
        espera = self._config.backoff_s
        for tentativa in range(1, self._config.tentativas + 1):
            try:
                return await self._cliente.get_pagina(pagina)
            except httpx.HTTPError:
                if tentativa == self._config.tentativas:
                    raise
                await self._dormir(espera)
                espera *= 2
        raise AssertionError("inalcançável")

    async def rastrear(self) -> ResultadoRastreio:
        res = ResultadoRastreio()
        por_id: dict[int, Consulta] = {}

        def absorver(html: str) -> int:
            p = parse_pagina(html, self._config.base_url)
            res.erros_parse += p.erros
            res.cards_lidos += len(p.consultas) + p.erros
            for c in p.consultas:
                por_id.setdefault(c.id, c)
            return p.total_paginas

        try:
            res.total_paginas = absorver(await self._baixar(1))
        except httpx.HTTPError:
            res.paginas_falhas.append(1)
            return res

        sem = asyncio.Semaphore(self._config.concorrencia)

        async def uma(pagina: int) -> None:
            async with sem:
                try:
                    absorver(await self._baixar(pagina))
                except httpx.HTTPError:
                    res.paginas_falhas.append(pagina)
                await self._dormir(self._config.pausa_s)

        await asyncio.gather(*(uma(p) for p in range(2, res.total_paginas + 1)))
        res.paginas_falhas.sort()
        res.consultas = list(por_id.values())
        return res
