import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from .config import Config
from .crawler import HttpCliente, Rastreador, ResultadoRastreio
from .validar import validar


def montar_saida(res: ResultadoRastreio, agora: datetime) -> dict:
    itens = sorted(res.consultas, key=lambda c: (-c.votos_total, -c.id))
    return {
        "atualizado_em": agora.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total": len(itens),
        "itens": [c.model_dump() for c in itens],
    }


def total_anterior(caminho: Path | None) -> int | None:
    if caminho is None or not caminho.exists():
        return None
    try:
        return int(json.loads(caminho.read_text(encoding="utf-8"))["total"])
    except (ValueError, KeyError, TypeError):
        return None


async def executar(args: argparse.Namespace, config: Config) -> int:
    cliente = HttpCliente(config)
    try:
        res = await Rastreador(cliente, config).rastrear()
    finally:
        await cliente.aclose()

    motivos = validar(res, total_anterior(args.anterior), config)
    if motivos:
        print("Reprovado, nada foi publicado:", file=sys.stderr)
        for m in motivos:
            print(f"  - {m}", file=sys.stderr)
        return 1

    saida = montar_saida(res, datetime.now(timezone.utc))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(saida, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"{saida['total']} itens em {args.out} ({res.total_paginas} páginas)")
    return 0


def main() -> None:
    p = argparse.ArgumentParser(description="Gera consultas.json a partir do e-Cidadania")
    p.add_argument("--out", type=Path, default=Path("out/consultas.json"))
    p.add_argument(
        "--anterior",
        type=Path,
        default=None,
        help="consultas.json publicado antes, para comparar o total",
    )
    args = p.parse_args()
    sys.exit(asyncio.run(executar(args, Config.do_ambiente())))


if __name__ == "__main__":
    main()
