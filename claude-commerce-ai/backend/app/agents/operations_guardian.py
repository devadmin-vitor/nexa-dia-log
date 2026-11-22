from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from pydantic import BaseModel

from app.agents.base import Agent, AgentContext
from app.domain.models import ActionType, AgentRunStatus, ApprovalStatus, LogLevel


class OpsOutput(BaseModel):
    status: Literal["ok", "atencao", "critico"]
    summary: str
    findings: list[str]
    recommend_kill_switch: bool


class OperationsGuardian(Agent[OpsOutput]):
    key = "operations_guardian"
    name = "Guardião de Operações"
    description = "Monitora custos de IA, falhas, aprovações pendentes e segurança; recomenda o kill switch quando necessário."
    responsibilities = [
        "Comparar gasto diário de IA com o orçamento",
        "Contar falhas e bloqueios nas últimas 24h",
        "Recomendar (não acionar) o kill switch — decisão humana",
    ]
    allowed_actions = [ActionType.read]
    output_model = OpsOutput
    instructions = "Avalie a saúde operacional a partir dos números fornecidos e liste achados acionáveis."

    def build_context(self, ctx: AgentContext, params: dict[str, Any]) -> dict[str, Any]:
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        runs = [r for r in ctx.store.agent_runs.values() if r.started_at >= since]
        return {
            "ai_spend_today_usd": ctx.store.ai_spend_today_usd(),
            "daily_budget_usd": ctx.settings.daily_ai_budget_usd,
            "runs_24h": len(runs),
            "failed_24h": sum(r.status == AgentRunStatus.failed for r in runs),
            "blocked_24h": sum(r.status == AgentRunStatus.blocked for r in runs),
            "pending_approvals": sum(a.status == ApprovalStatus.pending for a in ctx.store.approvals.values()),
            "security_events_24h": sum(1 for log in ctx.store.logs if log.level == LogLevel.security and log.ts >= since),
            "kill_switch_active": ctx.store.system.kill_switch_active,
            "ai_mode": "live" if ctx.llm.live else "simulated",
        }

    def simulate(self, ctx, c, params) -> OpsOutput:
        findings = []
        ratio = c["ai_spend_today_usd"] / c["daily_budget_usd"] if c["daily_budget_usd"] else 0
        if ratio >= 0.8:
            findings.append(f"Gasto de IA em {ratio:.0%} do orçamento diário.")
        if c["failed_24h"]:
            findings.append(f"{c['failed_24h']} execuções falharam nas últimas 24h.")
        if c["pending_approvals"]:
            findings.append(f"{c['pending_approvals']} aprovações aguardando decisão humana.")
        if c["ai_mode"] == "simulated":
            findings.append("IA em modo simulado: configure ANTHROPIC_API_KEY para análises reais.")
        critical = ratio >= 1 or c["failed_24h"] >= 5
        status = "critico" if critical else "atencao" if findings else "ok"
        return OpsOutput(status=status, summary=f"Status operacional: {status}.", findings=findings, recommend_kill_switch=critical)

    def apply(self, ctx, output, params) -> dict[str, Any]:
        if output.recommend_kill_switch:
            ctx.store.log(self.key, "ops.kill_switch_recommended", level=LogLevel.warning, details={"summary": output.summary})
        return {"kill_switch_recommended": output.recommend_kill_switch}
