import gzip
import json
from datetime import datetime, timezone

from plviewer.historico import gravar_snapshot
from plviewer.models import Consulta


def consulta(id, sim, nao):
    return Consulta(id=id, sigla="PL", numero=id, ano=2024, ementa="e",
                    votos_sim=sim, votos_nao=nao, url="u")


def utc(*args):
    return datetime(*args, tzinfo=timezone.utc)


def ler(caminho):
    return json.loads(gzip.decompress(caminho.read_bytes()))


def test_grava_id_sim_nao_ordenado_por_id(tmp_path):
    destino = gravar_snapshot([consulta(2, 5, 6), consulta(1, 3, 4)], utc(2026, 10, 21, 12), tmp_path)
    assert destino == tmp_path / "2026-10-21.json.gz"
    assert ler(destino)["itens"] == [[1, 3, 4], [2, 5, 6]]


def test_so_a_primeira_execucao_do_dia_grava(tmp_path):
    primeira = gravar_snapshot([consulta(1, 1, 1)], utc(2026, 10, 21, 12), tmp_path)
    segunda = gravar_snapshot([consulta(1, 9, 9)], utc(2026, 10, 21, 20), tmp_path)
    assert segunda is None
    assert ler(primeira)["itens"] == [[1, 1, 1]]


def test_dia_e_o_de_brasilia_nao_o_utc(tmp_path):
    # 02:00 UTC de 22/10 ainda é 23:00 de 21/10 em Brasília.
    assert gravar_snapshot([], utc(2026, 10, 22, 2), tmp_path).name == "2026-10-21.json.gz"
    # 03:00 UTC é meia-noite em Brasília: dia novo.
    assert gravar_snapshot([], utc(2026, 10, 22, 3), tmp_path).name == "2026-10-22.json.gz"
