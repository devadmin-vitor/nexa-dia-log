"""Orquestrador central.

O roteamento é determinístico (código), não decidido pela IA: isso torna a operação auditável,
previsível em custo e fácil de interromper. Cada passo verifica o kill switch antes de rodar.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from app.agents.base import Agent, AgentContext
from app.agents.commission_analyst import CommissionAnalyst
from app.agents.compliance_reviewer import ComplianceReviewer
from app.agents.content_planner import ContentPlanner
from app.agents.operations_guardian import OperationsGuardian
from app.agents.performance_monitor import PerformanceMonitor
from app.agents.product_researcher import ProductResearcher
from app.agents.scriptwriter import Scriptwriter
from app.core.errors import CommerceError, KillSwitchActive, NotFound
from app.domain.models import AgentRunStatus, new_id

AGENTS: dict[str, Agent] = {
    a.key: a
    for a in (
        ProductResearcher(),
        CommissionAnalyst(),
        ContentPlanner(),
        Scriptwriter(),
        ComplianceReviewer(),
        PerformanceMonitor(),
        OperationsGuardian(),
    )
}


@dataclass(frozen=True)
class Pipeline:
    key: str
    name: str
    steps: tuple[str, ...]
    stop_on_failure: bool
    description: str


PIPELINES: dict[str, Pipeline] = {
    p.key: p
    for p in (
        Pipeline("daily_cycle", "Ciclo diário", ("performance_monitor", "commission_analyst", "product_researcher", "operations_guardian"),
                 False, "Monitora desempenho, analisa comissões, reclassifica produtos e checa a operação."),
        Pipeline("weekly_planning", "Planejamento semanal", ("product_researcher", "content_planner"),
                 True, "Reclassifica produtos e propõe o calendário dos próximos 7 dias."),
        Pipeline("content_pipeline", "Produção de conteúdo", ("scriptwriter", "compliance_reviewer"),
                 True, "Gera roteiro e revisa conformidade; se aprovado, abre solicitação de publicação."),
        Pipeline("ops_check", "Verificação operacional", ("operations_guardian",),
                 False, "Custos, falhas, aprovações pendentes e eventos de segurança."),
    )
}


class Orchestrator:
    key = "orchestrator"
    name = "Orquestrador Central"

    def __init__(self, ctx: AgentContext):
        self.ctx = ctx

    def run_agent(self, agent_key: str, params: dict[str, Any] | None = None, *, trigger: str = "manual"):
        agent = AGENTS.get(agent_key)
        if not agent:
            raise NotFound(f"Agente '{agent_key}' não existe")
        if self.ctx.store.system.kill_switch_active:
            raise KillSwitchActive(f"Kill switch ativo: {self.ctx.store.system.kill_switch_reason}")
        return agent.run(self.ctx, params, trigger=trigger)

    def run_pipeline(self, pipeline_key: str, params: dict[str, Any] | None = None, *, trigger: str = "manual") -> dict:
        pipeline = PIPELINES.get(pipeline_key)
        if not pipeline:
            raise NotFound(f"Pipeline '{pipeline_key}' não existe")
        if pipeline_key == "content_pipeline" and not (params or {}).get("content_id"):
            raise CommerceError("content_pipeline exige content_id")
        if self.ctx.store.system.kill_switch_active:
            raise KillSwitchActive(f"Kill switch ativo: {self.ctx.store.system.kill_switch_reason}")

        pr = {"id": new_id(), "pipeline": pipeline_key, "trigger": trigger, "status": "running",
              "started_at": datetime.now(timezone.utc).isoformat(), "finished_at": None, "runs": []}
        self.ctx.store.pipeline_runs[pr["id"]] = pr
        self.ctx.store.log(self.key, "pipeline.started", entity_type="pipeline_run", entity_id=pr["id"],
                           details={"pipeline": pipeline_key, "trigger": trigger})
        status = "succeeded"
        for step in pipeline.steps:
            run = AGENTS[step].run(self.ctx, params, trigger="orchestrator", pipeline_run_id=pr["id"])
            pr["runs"].append({"agent_key": step, "run_id": run.id, "status": run.status.value, "error": run.error})
            if run.status == AgentRunStatus.blocked:
                status = "blocked"
                break
            if run.status == AgentRunStatus.failed:
                status = "partial" if not pipeline.stop_on_failure else "failed"
                if pipeline.stop_on_failure:
                    break
        pr["status"] = status
        pr["finished_at"] = datetime.now(timezone.utc).isoformat()
        self.ctx.store.log(self.key, f"pipeline.{status}", entity_type="pipeline_run", entity_id=pr["id"],
                           details={"pipeline": pipeline_key})
        return pr


def describe_architecture() -> dict:
    return {
        "orchestrator": {"key": Orchestrator.key, "name": Orchestrator.name,
                         "routing": "determinístico (código)", "guards": ["kill switch", "orçamento diário de IA", "política de aprovação"]},
        "agents": [a.describe() for a in AGENTS.values()],
        "pipelines": [{"key": p.key, "name": p.name, "steps": list(p.steps), "description": p.description} for p in PIPELINES.values()],
    }
