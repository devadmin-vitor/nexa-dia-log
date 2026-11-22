from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel

from app.agents.base import Agent, AgentContext
from app.domain.models import ActionType
from app.services import analytics


class PerformanceAlert(BaseModel):
    product_id: str
    severity: Literal["info", "warning", "critical"]
    message: str


class PerformanceOutput(BaseModel):
    summary: str
    highlights: list[str]
    alerts: list[PerformanceAlert]


class PerformanceMonitor(Agent[PerformanceOutput]):
    key = "performance_monitor"
    name = "Monitor de Desempenho"
    description = "Acompanha visualizações, cliques, pedidos e comissões; detecta quedas e altas relevantes."
    responsibilities = [
        "Comparar última semana com a anterior (cálculo determinístico)",
        "Gerar alertas de queda/alta por produto",
        "Resumir o desempenho para o operador",
    ]
    allowed_actions = [ActionType.read]
    output_model = PerformanceOutput
    instructions = "Interprete os KPIs e anomalias já calculados. Não invente números. Gere alertas apenas para product_id do contexto."

    def build_context(self, ctx: AgentContext, params: dict[str, Any]) -> dict[str, Any]:
        return {
            "kpis_7d": analytics.kpis(ctx.store, 7),
            "kpis_30d": analytics.kpis(ctx.store, 30),
            "anomalies_week_over_week": analytics.detect_anomalies(ctx.store),
        }

    def simulate(self, ctx, context, params) -> PerformanceOutput:
        alerts = [
            PerformanceAlert(
                product_id=a["product_id"],
                severity="critical" if a["change_pct"] <= -50 else "warning" if a["type"] == "queda" else "info",
                message=f"{a['product_name']}: comissão {a['type']} de {abs(a['change_pct'])}% semana a semana.",
            )
            for a in context["anomalies_week_over_week"]
        ]
        k7 = context["kpis_7d"]
        return PerformanceOutput(
            summary=f"Últimos 7 dias: {k7['orders']} pedidos, R$ {k7['commission_brl']:.2f} em comissão (modo simulado).",
            highlights=[f"CTR {k7['ctr']:.2%}", f"Conversão {k7['conversion_rate']:.2%}", f"EPC R$ {k7['epc_brl']:.2f}"],
            alerts=alerts,
        )

    def postprocess(self, ctx, output, context, params):
        output.alerts = [a for a in output.alerts if a.product_id in ctx.store.products]
        return output
