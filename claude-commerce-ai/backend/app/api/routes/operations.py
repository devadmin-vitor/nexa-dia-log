from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.agents.orchestrator import Orchestrator, describe_architecture
from app.api.deps import orchestrator_dep, store_dep
from app.core.config import get_settings
from app.core.errors import NotFound
from app.core.security import require_scheduler_token
from app.domain.models import (
    ActionType,
    ApprovalDecision,
    ContentStatus,
    KillSwitchUpdate,
    LogLevel,
)
from app.integrations import status as integrations
from app.services import approvals
from app.store.memory import MemoryStore

router = APIRouter(tags=["operations"])
scheduler_router = APIRouter(prefix="/scheduler", tags=["scheduler"])

_last_scheduler_trigger: dict[str, str | None] = {"at": None}


class RunParams(BaseModel):
    params: dict = Field(default_factory=dict)


# ---------------- agentes
@router.get("/agents")
def agents_architecture(store: MemoryStore = Depends(store_dep)):
    arch = describe_architecture()
    runs = store.list_runs(500)
    for a in arch["agents"]:
        mine = [r for r in runs if r.agent_key == a["key"]]
        a["last_run"] = mine[0].model_dump(mode="json", exclude={"output"}) if mine else None
        a["runs_total"] = len(mine)
        a["cost_usd_total"] = round(sum(r.cost_usd for r in mine), 6)
    return arch


@router.post("/agents/{agent_key}/run")
def run_agent(agent_key: str, body: RunParams | None = None, orch: Orchestrator = Depends(orchestrator_dep)):
    run = orch.run_agent(agent_key, (body or RunParams()).params, trigger="manual")
    return run.model_dump(mode="json")


@router.post("/pipelines/{pipeline_key}/run")
def run_pipeline(pipeline_key: str, body: RunParams | None = None, orch: Orchestrator = Depends(orchestrator_dep)):
    return orch.run_pipeline(pipeline_key, (body or RunParams()).params, trigger="manual")


@router.get("/runs")
def list_runs(limit: int = Query(50, ge=1, le=500), store: MemoryStore = Depends(store_dep)):
    return [r.model_dump(mode="json") for r in store.list_runs(limit)]


@router.get("/runs/{run_id}")
def get_run(run_id: str, store: MemoryStore = Depends(store_dep)):
    run = store.agent_runs.get(run_id)
    if not run:
        raise NotFound("Execução não encontrada")
    return run.model_dump(mode="json")


@router.get("/pipeline-runs")
def list_pipeline_runs(store: MemoryStore = Depends(store_dep)):
    return sorted(store.pipeline_runs.values(), key=lambda p: p["started_at"], reverse=True)[:50]


# ---------------- aprovações
@router.get("/approvals")
def list_approvals(store: MemoryStore = Depends(store_dep)):
    return [a.model_dump(mode="json") for a in store.list_approvals()]


@router.post("/approvals/{approval_id}/decision")
def decide(approval_id: str, body: ApprovalDecision, store: MemoryStore = Depends(store_dep)):
    req = approvals.decide(store, approval_id, body)
    # Conteúdo aprovado para publicação passa a "approved" (publicação manual).
    cid = req.payload.get("content_id")
    if cid and req.action_type == ActionType.publish_content and cid in store.content:
        c = store.content[cid]
        c.status = ContentStatus.approved if req.status == "approved" else ContentStatus.scripted
        store.upsert_content(c)
    return req.model_dump(mode="json")


# ---------------- logs
@router.get("/logs")
def list_logs(limit: int = Query(200, ge=1, le=2000), level: LogLevel | None = None, store: MemoryStore = Depends(store_dep)):
    logs = store.list_logs(limit if not level else 2000)
    if level:
        logs = [entry for entry in logs if entry.level == level][:limit]
    return [entry.model_dump(mode="json") for entry in logs]


@router.get("/costs")
def costs(store: MemoryStore = Depends(store_dep)):
    settings = get_settings()
    by_agent: dict[str, dict] = {}
    for r in store.agent_runs.values():
        a = by_agent.setdefault(r.agent_key, {"runs": 0, "live_runs": 0, "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0})
        a["runs"] += 1
        a["live_runs"] += r.mode == "live"
        a["input_tokens"] += r.input_tokens
        a["output_tokens"] += r.output_tokens
        a["cost_usd"] = round(a["cost_usd"] + r.cost_usd, 6)
    return {"today_usd": store.ai_spend_today_usd(), "daily_budget_usd": settings.daily_ai_budget_usd, "by_agent": by_agent}


# ---------------- sistema
@router.get("/system/status")
def system_status(store: MemoryStore = Depends(store_dep)):
    settings = get_settings()
    return {
        "settings": settings.public_view(),
        "kill_switch": store.system.model_dump(mode="json"),
        "integrations": [
            integrations.claude_status(settings),
            integrations.tiktok_shop_status(settings),
            integrations.supabase_status(settings),
            integrations.n8n_status(settings, _last_scheduler_trigger["at"]),
        ],
        "scheduled_tasks": [t.model_dump(mode="json") for t in store.tasks.values()],
        "storage": "memory (Fase 1 — dados perdidos ao reiniciar)",
    }


@router.post("/system/kill-switch")
def set_kill_switch(body: KillSwitchUpdate, store: MemoryStore = Depends(store_dep)):
    store.system.kill_switch_active = body.active
    store.system.kill_switch_reason = body.reason if body.active else None
    store.system.kill_switch_changed_at = datetime.now(timezone.utc)
    store.system.kill_switch_changed_by = body.changed_by
    store.log(body.changed_by, "system.kill_switch." + ("on" if body.active else "off"),
              level=LogLevel.security, details={"reason": body.reason})
    return store.system.model_dump(mode="json")


@router.post("/integrations/claude/test")
def test_claude():
    return integrations.test_claude(get_settings())


# ---------------- agendador (n8n)
@scheduler_router.post("/trigger/{task_key}")
def scheduler_trigger(task_key: str, _: str = Depends(require_scheduler_token),
                      store: MemoryStore = Depends(store_dep), orch: Orchestrator = Depends(orchestrator_dep)):
    task = store.tasks.get(task_key)
    if not task:
        raise NotFound("Tarefa agendada não encontrada")
    now = datetime.now(timezone.utc)
    _last_scheduler_trigger["at"] = now.isoformat()
    if not task.enabled:
        store.log("scheduler", "scheduler.skipped_disabled", details={"task": task_key})
        return {"task": task_key, "status": "skipped_disabled"}
    result = orch.run_pipeline(task.pipeline, {}, trigger="scheduler")
    task.last_run_at, task.last_status = now, result["status"]
    return {"task": task_key, "status": result["status"], "pipeline_run_id": result["id"]}


class TaskToggle(BaseModel):
    enabled: bool


@router.patch("/scheduled-tasks/{task_key}")
def toggle_task(task_key: str, body: TaskToggle, store: MemoryStore = Depends(store_dep)):
    task = store.tasks.get(task_key)
    if not task:
        raise NotFound("Tarefa agendada não encontrada")
    task.enabled = body.enabled
    store.log("operator", "scheduler.task_toggled", details={"task": task_key, "enabled": body.enabled})
    return task.model_dump(mode="json")
