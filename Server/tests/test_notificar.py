import json

import httpx
import pytest

from plviewer import notificar as n


def item(id, sim=0, nao=0, sigla="PL", numero=None, ano=2024):
    return {"id": id, "sigla": sigla, "numero": numero or id, "ano": ano,
            "ementa": "Ementa", "votos_sim": sim, "votos_nao": nao}


def tipos(eventos):
    return [(e.tipo, e.item["id"]) for e in eventos]


def test_consulta_nova():
    assert tipos(n.detectar([item(1)], [item(1), item(2)])) == [("nova", 2)]


def test_nova_ja_acima_de_marco_nao_gera_marco():
    assert tipos(n.detectar([], [item(1, 20_000)])) == [("nova", 1)]


def test_marco_cruzado_so_o_mais_alto():
    ev = n.detectar([item(1, 500, 400)], [item(1, 80_000, 30_000)])
    assert [(e.tipo, e.marco) for e in ev] == [("marco", 100_000)]


def test_sem_cruzar_marco_nao_notifica():
    assert n.detectar([item(1, 1_000)], [item(1, 9_000)]) == []


def test_marco_exato_conta_e_nao_repete():
    assert tipos(n.detectar([item(1, 999)], [item(1, 1_000)])) == [("marco", 1)]
    assert n.detectar([item(1, 1_000)], [item(1, 1_500)]) == []


def test_virada_de_resultado():
    ev = n.detectar([item(1, 10, 20)], [item(1, 30, 20)])
    assert [(e.tipo, e.vencedor) for e in ev] == [("virada", "sim")]


def test_empate_nao_e_virada():
    assert n.detectar([item(1, 10, 10)], [item(1, 10, 15)]) == []
    assert n.detectar([item(1, 10, 20)], [item(1, 20, 20)]) == []


def test_marco_e_virada_juntos():
    ev = n.detectar([item(1, 400, 500)], [item(1, 1_200, 500)])
    assert sorted(e.tipo for e in ev) == ["marco", "virada"]


def test_disjuntor_novas_e_outros():
    with pytest.raises(n.LimiteExcedido):
        n.checar_limites(n.detectar([], [item(i) for i in range(1, n.LIMITE_NOVAS + 2)]))
    antes = [item(i, 400, 0) for i in range(1, 202)]
    depois = [item(i, 1_200, 0) for i in range(1, 202)]
    with pytest.raises(n.LimiteExcedido):
        n.checar_limites(n.detectar(antes, depois))
    n.checar_limites(n.detectar([], [item(i) for i in range(1, n.LIMITE_NOVAS + 1)]))


def test_ate_3_individuais_e_acima_resumo():
    tres = n.montar_mensagens(n.detectar([], [item(i) for i in range(1, 4)]))
    assert [m.topico for m in tres] == ["t-PL-nova"] * 3
    assert all(m.dados == {"busca": f"PL {i}/2024"} for i, m in zip(range(1, 4), tres))
    quatro = n.montar_mensagens(n.detectar([], [item(i) for i in range(1, 5)]))
    assert len(quatro) == 1
    assert quatro[0].topico == "t-PL-nova"
    assert quatro[0].dados == {"tipo": "PL"}
    assert quatro[0].titulo == "PL: 4 novas consultas"
    assert quatro[0].corpo == "PL 1/2024, PL 2/2024, PL 3/2024 e mais 1."


def test_resumo_so_conta_o_mesmo_tipo_e_evento():
    novos = [item(1), item(2), item(3), item(4, sigla="PEC")]
    msgs = n.montar_mensagens(n.detectar([], novos))
    assert sorted(m.topico for m in msgs) == ["t-PEC-nova", "t-PL-nova", "t-PL-nova", "t-PL-nova"]


def test_marco_vai_para_tipo_e_para_seguidas_com_o_mesmo_tag():
    msgs = n.montar_mensagens(n.detectar([item(7, 500)], [item(7, 1_500)]))
    assert sorted(m.topico for m in msgs) == ["c-7-marco", "t-PL-marco"]
    assert {m.tag for m in msgs} == {"7-marco"}
    assert msgs[0].titulo == "PL 7/2024 passou de 1 mil votos"
    assert msgs[0].corpo == "1.500 votos, 100% sim."


def test_seguidas_sempre_individuais_mesmo_com_resumo_no_tipo():
    antes = [item(i, 500) for i in range(1, 6)]
    depois = [item(i, 1_500) for i in range(1, 6)]
    msgs = n.montar_mensagens(n.detectar(antes, depois))
    assert sum(m.topico.startswith("c-") for m in msgs) == 5
    assert [m.topico for m in msgs if m.topico.startswith("t-")] == ["t-PL-marco"]


def test_virada_texto():
    msgs = n.montar_mensagens(n.detectar([item(3, 10, 20)], [item(3, 30, 20)]))
    assert msgs[0].titulo == "PL 3/2024 virou: agora a maioria é de apoio"


def test_sigla_vira_topico_valido():
    msgs = n.montar_mensagens(n.detectar([], [item(1, sigla="Ç/X")]))
    assert msgs[0].topico == "t-__X-nova"


def test_ementa_longa_e_cortada():
    longa = item(1)
    longa["ementa"] = "a" * 300
    (m,) = n.montar_mensagens(n.detectar([], [longa]))
    assert len(m.corpo) == 120 and m.corpo.endswith("...")


def test_corpo_fcm():
    (m,) = n.montar_mensagens(n.detectar([], [item(1)]))
    msg = n.corpo_fcm(m)["message"]
    assert msg["topic"] == "t-PL-nova"
    assert msg["android"]["notification"]["tag"] == "1-nova"
    assert msg["data"] == {"busca": "PL 1/2024"}


class Coletor:
    def __init__(self):
        self.enviadas = []

    def enviar(self, m):
        self.enviadas.append(m)


def test_notificar_envia_tudo_e_disjuntor_nao_envia_nada():
    c = Coletor()
    assert n.notificar([item(1)], [item(1), item(2)], c) == 1
    assert len(c.enviadas) == 1
    c2 = Coletor()
    with pytest.raises(n.LimiteExcedido):
        n.notificar([], [item(i) for i in range(1, 100)], c2)
    assert c2.enviadas == []


def test_enviador_fcm_repete_em_5xx(monkeypatch):
    chamadas = []

    def tratar(req):
        chamadas.append(req)
        return httpx.Response(503 if len(chamadas) == 1 else 200, json={})

    monkeypatch.setattr(n.time, "sleep", lambda s: None)
    env = object.__new__(n.EnviadorFcm)
    env._url = "https://fcm.test/send"
    env._http = httpx.Client(transport=httpx.MockTransport(tratar))
    env._renovar = None

    class Creds:
        valid = True
        token = "tok"

    env._creds = Creds()
    (m,) = n.montar_mensagens(n.detectar([], [item(1)]))
    env.enviar(m)
    assert len(chamadas) == 2
    assert chamadas[0].headers["authorization"] == "Bearer tok"
    assert json.loads(chamadas[0].content)["message"]["topic"] == "t-PL-nova"
