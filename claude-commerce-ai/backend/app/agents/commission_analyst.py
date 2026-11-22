from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel

from app.agents.base import Agent, AgentContext
from app.domain.models import ActionType
from app.services import analytics


class CommissionRecommendation(BaseModel):
    product_id: str
    action: Literal["priorizar", "manter", "revisar", "pausar"]
    reason: str


class CommissionAnalysisOutput(BaseModel):
    summary: str
    insights: list[str]
    recommendations: list[CommissionRecommendation]


class CommissionAnalyst(Agent[CommissionAnalysisOutput]):
    key = "commission_analyst"
    name = "Analista de Comissões"
    description = "Analisa comissões, EPC e ticket médio por produto e recomenda onde concentrar esforço."
    responsibilities = [
        "Calcular comissão total, EPC e ticket médio (cálculo determinístico)",
        "Recomendar priorizar/manter/revisar/pausar",
        "Nunca executar operação financeira — sugestões vão para aprovação",
    ]
    allowed_actions = [ActionType.read]
    output_model = CommissionAnalysisOutput
    instructions = (
        "Os números já foram calculados pelo sistema; não recalcule nem invente valores. "
        "Interprete-os e recomende uma ação por produto, com justificativa curta."
    )

    def build_context(self, ctx: AgentContext, params: dict[str, Any]) -> dict[str, Any]:
        return {"totals_30d": analytics.kpis(ctx.store, 30), "by_product_30d": analytics.by_product(ctx.store, 30)}

    def simulate(self, ctx, context, params) -> CommissionAnalysisOutput:
        rows = context["by_product_30d"]
        avg_epc = (sum(r["epc_brl"] for r in rows) / len(rows)) if rows else 0
        recs = []
        for r in rows:
            if r["epc_brl"] >= avg_epc * 1.25:
                action, why = "priorizar", "EPC acima da média"
            elif r["epc_brl"] >= avg_epc * 0.8:
                action, why = "manter", "EPC próximo da média"
            elif r["orders"] > 0:
                action, why = "revisar", "EPC abaixo da média; revisar ângulo de conteúdo"
            else:
                action, why = "pausar", "Sem pedidos no período"
            recs.append(CommissionRecommendation(product_id=r["product_id"], action=action, reason=f"{why} (R$ {r['epc_brl']:.2f}/clique)."))
        t = context["totals_30d"]
        return CommissionAnalysisOutput(
            summary=f"Comissão em 30 dias: R$ {t['commission_brl']:.2f} em {t['orders']} pedidos (modo simulado).",
            insights=[f"EPC médio por produto: R$ {avg_epc:.2f}", f"Fontes de dados: {', '.join(t['data_sources']) or 'nenhuma'}"],
            recommendations=recs,
        )

    def postprocess(self, ctx, output, context, params):
        valid = {r["product_id"] for r in context["by_product_30d"]}
        output.recommendations = [r for r in output.recommendations if r.product_id in valid]
        return output
