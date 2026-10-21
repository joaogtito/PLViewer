import gzip
import json
from datetime import datetime, timezone

from plviewer.crawler import ResultadoRastreio
from plviewer.main import montar_saida, serializar
from plviewer.models import Consulta


def consulta(id, sim, nao):
    return Consulta(id=id, sigla="PL", numero=id, ano=2024, ementa="e",
                    votos_sim=sim, votos_nao=nao, url="u")


def test_saida_so_tem_campos_nao_derivados_e_ordem_por_votos():
    res = ResultadoRastreio(consultas=[consulta(1, 1, 0), consulta(2, 5, 5), consulta(3, 1, 0)])
    saida = montar_saida(res, datetime(2026, 10, 21, 12, 0, tzinfo=timezone.utc))
    assert saida["atualizado_em"] == "2026-10-21T12:00:00Z"
    assert saida["total"] == 3
    assert [i["id"] for i in saida["itens"]] == [2, 3, 1]
    assert set(saida["itens"][0]) == {
        "id", "sigla", "numero", "ano", "ementa", "votos_sim", "votos_nao"
    }


def test_gzip_volta_ao_mesmo_json():
    saida = {"atualizado_em": "x", "total": 0, "itens": []}
    corpo = serializar(saida)
    assert json.loads(gzip.decompress(gzip.compress(corpo, mtime=0))) == saida
