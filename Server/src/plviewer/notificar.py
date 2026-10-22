"""Detecta o que mudou entre dois consultas.json e envia notificações push (FCM, por tópicos).

Sem estado: compara o JSON anterior com o novo. Os tópicos são o contrato com o app:

    t-<SIGLA>-<evento>    tipo de proposição (ex.: t-PL-nova, t-PEC-marco)
    c-<id>-<evento>       consulta seguida, só marco e virada (ex.: c-137929-marco)

Eventos: nova, marco, virada. Quem escolhe tipos, eventos e consultas seguidas é o usuário no app,
que se inscreve nos tópicos correspondentes.
"""

import json
import re
import time
from dataclasses import dataclass
from typing import Literal, Protocol

import httpx

TipoEvento = Literal["nova", "marco", "virada"]

# Votos totais (sim + não) que disparam o evento "marco". Só o mais alto cruzado conta.
MARCOS = (1_000, 10_000, 50_000, 100_000, 500_000, 1_000_000)

# Acima disso numa rodada, algo está errado com os dados: não envia nada.
LIMITE_NOVAS = 50
LIMITE_OUTROS = 200

# Até este número de eventos no mesmo tópico de tipo saem individuais; acima, um resumo.
MAX_INDIVIDUAIS = 3

Item = dict  # item do consultas.json: id, sigla, numero, ano, ementa, votos_sim, votos_nao


class LimiteExcedido(Exception):
    """O disjuntor disparou: eventos demais para ser real."""


@dataclass(frozen=True)
class Evento:
    tipo: TipoEvento
    item: Item
    marco: int | None = None  # só para "marco"
    vencedor: str | None = None  # só para "virada": "sim" ou "não"


@dataclass(frozen=True)
class Mensagem:
    topico: str
    titulo: str
    corpo: str
    tag: str
    dados: dict[str, str]


def titulo(item: Item) -> str:
    return f"{item['sigla']} {item['numero']}/{item['ano']}"


def _total(item: Item) -> int:
    return item["votos_sim"] + item["votos_nao"]


def _vencedor(item: Item) -> str | None:
    if item["votos_sim"] > item["votos_nao"]:
        return "sim"
    if item["votos_nao"] > item["votos_sim"]:
        return "não"
    return None


def _marco_cruzado(antes: int, depois: int) -> int | None:
    cruzados = [m for m in MARCOS if antes < m <= depois]
    return cruzados[-1] if cruzados else None


def detectar(anterior: list[Item], novo: list[Item]) -> list[Evento]:
    """Eventos entre dois rastreios. Uma consulta nova não gera marco nem virada."""
    antes = {i["id"]: i for i in anterior}
    eventos: list[Evento] = []
    for item in novo:
        velho = antes.get(item["id"])
        if velho is None:
            eventos.append(Evento("nova", item))
            continue
        marco = _marco_cruzado(_total(velho), _total(item))
        if marco is not None:
            eventos.append(Evento("marco", item, marco=marco))
        v_antes, v_depois = _vencedor(velho), _vencedor(item)
        # Empate não conta como lado: só vira quando um lado passa o outro.
        if v_antes and v_depois and v_antes != v_depois:
            eventos.append(Evento("virada", item, vencedor=v_depois))
    return eventos


def checar_limites(eventos: list[Evento]) -> None:
    novas = sum(e.tipo == "nova" for e in eventos)
    outros = len(eventos) - novas
    if novas > LIMITE_NOVAS or outros > LIMITE_OUTROS:
        raise LimiteExcedido(
            f"{novas} consultas novas (limite {LIMITE_NOVAS}) e {outros} marcos/viradas "
            f"(limite {LIMITE_OUTROS}) numa só rodada; nada foi enviado."
        )


def _milhar(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def _rotulo_marco(n: int) -> str:
    return "1 milhão" if n == 1_000_000 else f"{n // 1000} mil"


def _seguro(sigla: str) -> str:
    """Tópico do FCM só aceita [a-zA-Z0-9-_.~%]."""
    return re.sub(r"[^A-Za-z0-9_.~%-]", "_", sigla)


def _texto(e: Evento) -> tuple[str, str]:
    t, i = titulo(e.item), e.item
    if e.tipo == "nova":
        ementa = i["ementa"]
        return f"Nova consulta: {t}", ementa if len(ementa) <= 120 else ementa[:117].rstrip() + "..."
    total = _total(i)
    pct = round(i["votos_sim"] * 100 / total) if total else 0
    detalhe = f"{_milhar(total)} votos, {pct}% sim."
    if e.tipo == "marco":
        return f"{t} passou de {_rotulo_marco(e.marco)} votos", detalhe
    lado = "apoio" if e.vencedor == "sim" else "rejeição"
    return f"{t} virou: agora a maioria é de {lado}", detalhe


def _individual(e: Evento, topico: str) -> Mensagem:
    titulo_msg, corpo = _texto(e)
    return Mensagem(
        topico=topico,
        titulo=titulo_msg,
        corpo=corpo,
        tag=f"{e.item['id']}-{e.tipo}",  # tipo e seguida usam o mesmo tag: a 2ª substitui a 1ª
        dados={"busca": titulo(e.item)},
    )


def _resumo(sigla: str, tipo: TipoEvento, eventos: list[Evento]) -> Mensagem:
    n = len(eventos)
    plural = n != 1
    assunto = {
        "nova": f"{n} nova{'s' if plural else ''} consulta{'s' if plural else ''}",
        "marco": f"{n} consulta{'s' if plural else ''} com novo marco de votos",
        "virada": f"{n} consulta{'s' if plural else ''} com resultado virado",
    }[tipo]
    nomes = ", ".join(titulo(e.item) for e in eventos[:3])
    return Mensagem(
        topico=f"t-{_seguro(sigla)}-{tipo}",
        titulo=f"{sigla}: {assunto}",
        corpo=f"{nomes} e mais {n - 3}." if n > 3 else nomes,
        tag=f"resumo-{_seguro(sigla)}-{tipo}",
        dados={"tipo": sigla},
    )


def montar_mensagens(eventos: list[Evento]) -> list[Mensagem]:
    mensagens: list[Mensagem] = []
    por_topico: dict[tuple[str, TipoEvento], list[Evento]] = {}
    for e in eventos:
        por_topico.setdefault((e.item["sigla"], e.tipo), []).append(e)
        if e.tipo != "nova":  # quem segue a consulta recebe sempre individual
            mensagens.append(_individual(e, f"c-{e.item['id']}-{e.tipo}"))
    for (sigla, tipo), grupo in por_topico.items():
        if len(grupo) > MAX_INDIVIDUAIS:
            mensagens.append(_resumo(sigla, tipo, grupo))
        else:
            mensagens.extend(_individual(e, f"t-{_seguro(sigla)}-{tipo}") for e in grupo)
    return mensagens


def carregar_itens(caminho) -> list[Item]:
    return json.loads(caminho.read_text(encoding="utf-8"))["itens"]


# --- envio -------------------------------------------------------------------------------------


class Enviador(Protocol):
    def enviar(self, mensagem: Mensagem) -> None: ...


class EnviadorDryRun:
    """Só imprime; para testar sem Firebase."""

    def enviar(self, mensagem: Mensagem) -> None:
        print(f"[dry-run] {mensagem.topico}: {mensagem.titulo} | {mensagem.corpo}")


def corpo_fcm(m: Mensagem) -> dict:
    return {
        "message": {
            "topic": m.topico,
            "notification": {"title": m.titulo, "body": m.corpo},
            "android": {"notification": {"tag": m.tag}},
            "data": m.dados,
        }
    }


class EnviadorFcm:
    """FCM HTTP v1 com conta de serviço (o JSON inteiro vem do secret FIREBASE_SERVICE_ACCOUNT)."""

    ESCOPO = "https://www.googleapis.com/auth/firebase.messaging"

    def __init__(self, conta_servico_json: str, cliente: httpx.Client | None = None) -> None:
        from google.auth.transport.requests import Request
        from google.oauth2 import service_account

        info = json.loads(conta_servico_json)
        self._creds = service_account.Credentials.from_service_account_info(
            info, scopes=[self.ESCOPO]
        )
        self._renovar = Request()
        self._url = f"https://fcm.googleapis.com/v1/projects/{info['project_id']}/messages:send"
        self._http = cliente or httpx.Client(timeout=20)

    def enviar(self, mensagem: Mensagem) -> None:
        if not self._creds.valid:
            self._creds.refresh(self._renovar)
        cabecalho = {"Authorization": f"Bearer {self._creds.token}"}
        for tentativa in range(3):
            r = self._http.post(self._url, json=corpo_fcm(mensagem), headers=cabecalho)
            if r.status_code < 500 and r.status_code != 429:
                break
            time.sleep(2**tentativa)
        r.raise_for_status()


def notificar(anterior: list[Item], novo: list[Item], enviador: Enviador) -> int:
    """Detecta, confere o disjuntor e envia. Devolve quantas mensagens foram enviadas."""
    eventos = detectar(anterior, novo)
    checar_limites(eventos)
    mensagens = montar_mensagens(eventos)
    for m in mensagens:
        enviador.enviar(m)
    return len(mensagens)
