from .config import Config
from .crawler import ResultadoRastreio


def validar(
    res: ResultadoRastreio, total_anterior: int | None, config: Config
) -> list[str]:
    """Devolve os motivos de reprovação; lista vazia = pode publicar."""
    if res.total_paginas == 0:
        return ["página 1 não pôde ser baixada"]

    motivos: list[str] = []
    if res.cards_lidos == 0:
        motivos.append("nenhum card encontrado (o layout mudou?)")
    if res.paginas_falhas:
        motivos.append(f"rastreio incompleto: páginas com falha {res.paginas_falhas}")
    if (
        total_anterior
        and len(res.consultas) < total_anterior * config.min_fracao_anterior
    ):
        motivos.append(
            f"total {len(res.consultas)} abaixo de "
            f"{config.min_fracao_anterior:.0%} do anterior ({total_anterior})"
        )
    if res.cards_lidos and res.erros_parse / res.cards_lidos > config.max_taxa_erros:
        motivos.append(
            f"{res.erros_parse} de {res.cards_lidos} cards descartados por erro de parse"
        )
    return motivos
