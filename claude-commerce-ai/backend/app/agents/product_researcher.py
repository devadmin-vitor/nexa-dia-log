from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.agents.base import Agent, AgentContext
from app.domain.models import ActionType, ProductClass, ProductStatus
from app.services import analytics


class ProductEvaluation(BaseModel):
    product_id: str
    classification: Literal["A", "B", "C"]
    score: int = Field(ge=0, le=100)
    rationale: str
    risks: list[str]


class ProductResearchOutput(BaseModel):
    summary: str
    evaluations: list[ProductEvaluation]
    missing_information: list[str]


class ProductResearcher(Agent[ProductResearchOutput]):
    key = "product_researcher"
    name = "Pesquisador de Produtos"
    description = "Avalia e classifica (A/B/C) os produtos cadastrados ou importados, com base em comissão, desempenho e riscos."
    responsibilities = [
        "Pontuar produtos de 0 a 100",
        "Classificar em A (priorizar), B (testar) e C (evitar)",
        "Apontar riscos: falta de amostra, direitos de mídia, margem baixa",
    ]
    allowed_actions = [ActionType.read, ActionType.internal_write]
    output_model = ProductResearchOutput
    instructions = (
        "Avalie cada produto do contexto. Considere taxa de comissão, ganho por clique (EPC), conversão, "
        "se há amostra física (necessária para demonstrações reais) e se os direitos de mídia foram confirmados. "
        "Só avalie produtos presentes no contexto, usando o product_id exato."
    )

    def build_context(self, ctx: AgentContext, params: dict[str, Any]) -> dict[str, Any]:
        perf = {r["product_id"]: r for r in analytics.by_product(ctx.store, days=30)}
        products = [
            {
                "product_id": p.id, "name": p.name, "category": p.category, "price_brl": p.price_brl,
                "commission_rate": p.commission_rate, "status": p.status.value,
                "sample_received": p.sample_received, "media_rights_confirmed": p.media_rights_confirmed,
                "data_source": p.data_source.value,
                "last_30d": {k: perf[p.id][k] for k in ("orders", "commission_brl", "epc_brl", "conversion_rate", "ctr")} if p.id in perf else None,
            }
            for p in ctx.store.list_products() if p.status != ProductStatus.rejected
        ]
        return {"products": products}

    def simulate(self, ctx, context, params) -> ProductResearchOutput:
        evals = []
        for p in context["products"]:
            perf = p["last_30d"] or {}
            score = min(100.0, p["commission_rate"] * 250)  # 20% → 50 pts
            score += min(25.0, perf.get("epc_brl", 0) * 25)
            score += min(15.0, perf.get("conversion_rate", 0) * 200)
            risks = []
            if not p["sample_received"]:
                risks.append("Sem amostra física: não é possível gravar demonstração real.")
                score -= 10
            if not p["media_rights_confirmed"]:
                risks.append("Direitos de uso das mídias do vendedor não confirmados.")
                score -= 5
            if not perf:
                risks.append("Sem histórico de desempenho; classificação baseada só em comissão.")
            score = int(max(0, min(100, round(score + 10))))
            cls = "A" if score >= 60 else "B" if score >= 40 else "C"
            evals.append(ProductEvaluation(
                product_id=p["product_id"], classification=cls, score=score,
                rationale=f"Comissão de {p['commission_rate']:.0%}; EPC R$ {perf.get('epc_brl', 0):.2f} (heurística simulada).",
                risks=risks,
            ))
        return ProductResearchOutput(
            summary=f"{len(evals)} produtos avaliados por heurística determinística (modo simulado).",
            evaluations=evals,
            missing_information=["Dados de concorrência e tendência de categoria exigem fonte oficial autorizada."],
        )

    def apply(self, ctx, output, params) -> dict[str, Any]:
        updated = 0
        for ev in output.evaluations:
            p = ctx.store.products.get(ev.product_id)
            if not p:
                continue  # ignora IDs não existentes (proteção contra alucinação)
            p.classification = ProductClass(ev.classification)
            p.score = float(ev.score)
            ctx.store.upsert_product(p)
            updated += 1
        return {"products_classified": updated}
