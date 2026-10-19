import os
from dataclasses import dataclass

BASE_URL = "https://www12.senado.leg.br/ecidadania"
# Cabeçalhos HTTP só aceitam ASCII: nada de acento aqui.
USER_AGENT = "ConsultasSenadoApp/0.1 (independent reader of public data)"


def _env(nome: str, padrao, tipo):
    valor = os.environ.get(nome)
    return tipo(valor) if valor else padrao


@dataclass(frozen=True)
class Config:
    base_url: str = BASE_URL
    user_agent: str = USER_AGENT
    concorrencia: int = 3
    pausa_s: float = 0.15
    tentativas: int = 4
    backoff_s: float = 1.5
    timeout_s: float = 30.0
    max_taxa_erros: float = 0.01
    min_fracao_anterior: float = 0.5

    @classmethod
    def do_ambiente(cls) -> "Config":
        return cls(
            base_url=_env("PLV_BASE_URL", BASE_URL, str),
            user_agent=_env("PLV_USER_AGENT", USER_AGENT, str),
            concorrencia=_env("PLV_CONCORRENCIA", 3, int),
            pausa_s=_env("PLV_PAUSA_S", 0.15, float),
            tentativas=_env("PLV_TENTATIVAS", 4, int),
            backoff_s=_env("PLV_BACKOFF_S", 1.5, float),
            timeout_s=_env("PLV_TIMEOUT_S", 30.0, float),
            max_taxa_erros=_env("PLV_MAX_TAXA_ERROS", 0.01, float),
            min_fracao_anterior=_env("PLV_MIN_FRACAO_ANTERIOR", 0.5, float),
        )
