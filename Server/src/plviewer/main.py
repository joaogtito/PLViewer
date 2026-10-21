import argparse
import asyncio
import gzip
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from .config import Config
from .crawler import HttpCliente, Rastreador, ResultadoRastreio
from .validar import validar


# Só o que o app não consegue calcular. titulo, url, votos_total e pct_sim
# são derivados no cliente (web/src/lib/dados.ts).
CAMPOS = {"id", "sigla", "numero", "ano", "ementa", "votos_sim", "votos_nao"}


def montar_saida(res: ResultadoRastreio, agora: datetime) -> dict:
    itens = sorted(res.consultas, key=lambda c: (-c.votos_total, -c.id))
    return {
        "atualizado_em": agora.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total": len(itens),
        "itens": [c.model_dump(include=CAMPOS) for c in itens],
    }


def serializar(saida: dict) -> bytes:
    return json.dumps(saida, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


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
    corpo = serializar(saida)
    args.out.write_bytes(corpo)
    # O raw.githubusercontent não comprime; o app lê esta versão (~5x menor).
    # mtime=0 deixa o arquivo idêntico para o mesmo conteúdo.
    args.out.with_name(args.out.name + ".gz").write_bytes(
        gzip.compress(corpo, compresslevel=9, mtime=0)
    )
    print(f"{saida['total']} itens em {args.out} (+ .gz, {res.total_paginas} páginas)")
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
