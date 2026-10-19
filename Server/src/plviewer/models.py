from pydantic import BaseModel, computed_field


class Consulta(BaseModel):
    id: int
    sigla: str
    numero: int
    ano: int
    ementa: str
    votos_sim: int
    votos_nao: int
    url: str

    @computed_field
    @property
    def titulo(self) -> str:
        return f"{self.sigla} {self.numero}/{self.ano}"

    @computed_field
    @property
    def votos_total(self) -> int:
        return self.votos_sim + self.votos_nao

    @computed_field
    @property
    def pct_sim(self) -> float | None:
        total = self.votos_sim + self.votos_nao
        if total == 0:
            return None
        return round(self.votos_sim * 100 / total, 2)
