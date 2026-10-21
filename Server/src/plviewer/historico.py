import gzip
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from .models import Consulta

FUSO = ZoneInfo("America/Sao_Paulo")


def gravar_snapshot(
    consultas: list[Consulta], agora: datetime, pasta: Path
) -> Path | None:
    """Grava o snapshot do dia (data de Brasília) se ainda não existir.

    Chamado a cada execução: só a primeira depois da meia-noite grava.
    Cada item é [id, votos_sim, votos_nao] para manter o arquivo pequeno.
    """
    dia = agora.astimezone(FUSO).date().isoformat()
    destino = pasta / f"{dia}.json.gz"
    if destino.exists():
        return None
    corpo = {
        "data": dia,
        "atualizado_em": agora.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "itens": [[c.id, c.votos_sim, c.votos_nao] for c in sorted(consultas, key=lambda c: c.id)],
    }
    pasta.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(
        gzip.compress(
            json.dumps(corpo, separators=(",", ":")).encode("utf-8"),
            compresslevel=9,
            mtime=0,
        )
    )
    return destino
