from __future__ import annotations

from typing import Any

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from apps.api.deps import get_conn
from core import agent_registry, approvals, audit, cost_control, emergency, products, scheduler, task_manager
from core.claude_client import connection_test
from core.config import get_settings
from core.security import require_scheduler_token

router = APIRouter()
scheduler_router = APIRouter(prefix="/scheduler", tags=["scheduler"])


# ---------------------------------------------------------------- visão geral
@router.get("/overview", tags=["overview"])
def overview(conn: psycopg.Connection = Depends(get_conn)):
    return {
        "emergency": emergency.status(conn),
        "budget": cost_control.budget_status(conn),
        "tasks": task_manager.counts(conn),
        "pending_approvals": len(approvals.list_approvals(conn, "pending")),
        "agents": len(agent_registry.list_agents(conn)),
        "products": conn.execute(
            "select count(*) filter (where not is_simulated) as real, count(*) filter (where is_simulated) as simulated "
            "from public.products").fetchone(),
        "settings": get_settings().public_view(),
    }


# ---------------------------------------------------------------- agentes
@router.get("/agents", tags=["agents"])
def list_agents(conn: psycopg.Connection = Depends(get_conn)):
    rows = agent_registry.list_agents(conn)
    reg = agent_registry.load_registry()
    for r in rows:
        spec = reg["agents"].get(r["agent_key"])
        r["prompt_file"] = f"agents/{spec.folder}/system_prompt.md" if spec else None
    return {"agents": rows, "project": reg["project"], "security": reg["security"]}


# ---------------------------------------------------------------- tarefas
class TaskIn(BaseModel):
    agent_key: str = Field(pattern=r"^[a-z_]{3,40}$")
    task_type: str = Field(min_length=3, max_length=80)
    payload: dict[str, Any] = Field(default_factory=dict)
    priority: int = Field(default=5, ge=1, le=10)
    idempotency_key: str | None = Field(default=None, max_length=200)


@router.get("/tasks", tags=["tasks"])
def list_tasks(status: str | None = Query(default=None, pattern="^(queued|running|succeeded|failed|blocked|cancelled)$"),
               limit: int = Query(100, ge=1, le=500), conn: psycopg.Connection = Depends(get_conn)):
    return {"tasks": task_manager.list_tasks(conn, status=status, limit=limit), "counts": task_manager.counts(conn)}


@router.post("/tasks", status_code=201, tags=["tasks"])
def create_task(body: TaskIn, conn: psycopg.Connection = Depends(get_conn)):
    return task_manager.enqueue(conn, agent_key=body.agent_key, task_type=body.task_type, payload=body.payload,
                                priority=body.priority, idempotency_key=body.idempotency_key, requested_by="operator")


@router.post("/tasks/{task_id}/cancel", tags=["tasks"])
def cancel_task(task_id: str, conn: psycopg.Connection = Depends(get_conn)):
    return task_manager.cancel(conn, task_id, "operator")


# ---------------------------------------------------------------- aprovações
class DecisionIn(BaseModel):
    approve: bool
    decided_by: str = Field(min_length=2, max_length=120)
    reason: str | None = Field(default=None, max_length=1000)


@router.get("/approvals", tags=["approvals"])
def list_approvals(status: str | None = Query(default=None, pattern="^(pending|approved|rejected|expired)$"),
                   conn: psycopg.Connection = Depends(get_conn)):
    return approvals.list_approvals(conn, status)


@router.post("/approvals/{approval_id}/decision", tags=["approvals"])
def decide(approval_id: str, body: DecisionIn, conn: psycopg.Connection = Depends(get_conn)):
    return approvals.decide(conn, approval_id, approve=body.approve, decided_by=body.decided_by, reason=body.reason)


# ---------------------------------------------------------------- produtos
class StatusIn(BaseModel):
    status: str = Field(pattern="^(candidate|approved|active|paused|rejected)$")


@router.get("/products", tags=["products"])
def list_products(conn: psycopg.Connection = Depends(get_conn)):
    return products.list_products(conn)


@router.post("/products", tags=["products"])
def create_product(body: products.ProductIn, conn: psycopg.Connection = Depends(get_conn)):
    row, created = products.save(conn, body, actor="operator")
    return {"product": row, "created": created,
            "message": "Produto cadastrado" if created else "Produto já existia (mesmo ID externo ou URL); nada foi duplicado"}


@router.patch("/products/{product_id}/status", tags=["products"])
def product_status(product_id: str, body: StatusIn, conn: psycopg.Connection = Depends(get_conn)):
    row = products.set_status(conn, product_id, body.status, actor="operator")
    if not row:
        raise HTTPException(404, "Produto não encontrado")
    return row


# ---------------------------------------------------------------- custos e auditoria
@router.get("/costs", tags=["costs"])
def costs(conn: psycopg.Connection = Depends(get_conn)):
    return {
        "budget": cost_control.budget_status(conn),
        "daily": conn.execute("select * from public.v_cost_daily order by day desc limit 31").fetchall(),
        "by_agent": conn.execute(
            "select agent_key, model, count(*) as calls, sum(input_tokens) as input_tokens, "
            "sum(output_tokens) as output_tokens, sum(estimated_cost_brl) as cost_brl from public.cost_usage "
            "group by agent_key, model order by cost_brl desc").fetchall(),
    }


@router.get("/audit", tags=["audit"])
def audit_logs(limit: int = Query(200, ge=1, le=1000),
               level: str | None = Query(default=None, pattern="^(info|warning|error|security)$"),
               conn: psycopg.Connection = Depends(get_conn)):
    return audit.recent(conn, limit, level)


# ---------------------------------------------------------------- sistema
class EmergencyIn(BaseModel):
    active: bool
    reason: str = Field(min_length=3, max_length=500)
    changed_by: str = Field(min_length=2, max_length=120)


@router.get("/system/emergency", tags=["system"])
def emergency_status(conn: psycopg.Connection = Depends(get_conn)):
    return emergency.status(conn)


@router.post("/system/emergency", tags=["system"])
def set_emergency(body: EmergencyIn, conn: psycopg.Connection = Depends(get_conn)):
    return emergency.set_stop(conn, active=body.active, reason=body.reason, changed_by=body.changed_by)


@router.get("/system/schedules", tags=["system"])
def schedules():
    return [{"key": j.key, "name": j.name, "cron": j.cron, "timezone": "America/Sao_Paulo",
             "workflow_file": j.workflow_file} for j in scheduler.JOBS.values()]


@router.post("/integrations/claude/test", tags=["system"])
def claude_test(conn: psycopg.Connection = Depends(get_conn)):
    emergency.ensure_not_stopped(conn)
    result = connection_test()
    audit.audit(conn, "operator", "integration.claude.test", success=result["ok"], details=result)
    return result


# ---------------------------------------------------------------- agendador (n8n)
@scheduler_router.post("/trigger/{job_key}")
def trigger(job_key: str, _: str = Depends(require_scheduler_token), conn: psycopg.Connection = Depends(get_conn)):
    return scheduler.trigger(conn, job_key)
