"""Fila de tarefas dos agentes, persistida em public.agent_tasks.

A fila usa o próprio PostgreSQL (`FOR UPDATE SKIP LOCKED`) em vez de RQ: o RQ depende de `fork`
e não roda workers nativamente no Windows. O Redis fica disponível para cache, locks e limites.

Regras:
- idempotency_key evita duplicar a mesma tarefa;
- limite diário de tarefas (orchestrator.daily_task_limit);
- parada de emergência bloqueia criação e execução;
- falhas são re-tentadas até max_attempts com atraso exponencial.
"""

from __future__ import annotations

from typing import Any

import psycopg

from core import emergency
from core.agent_registry import load_registry
from core.audit import audit
from core.db import Jsonb, fetch_all, fetch_one
from core.errors import LimitExceeded, NotFound, PermissionDenied

STATUSES = ("queued", "running", "succeeded", "failed", "blocked", "cancelled")


def _agent(conn: psycopg.Connection, agent_key: str) -> dict:
    row = fetch_one(conn, "select id, agent_key, enabled from public.agents where agent_key = %s", (agent_key,))
    if not row:
        raise NotFound(f"Agente '{agent_key}' não registrado (a API sincroniza na inicialização)")
    if not row["enabled"]:
        raise PermissionDenied(f"Agente '{agent_key}' está desativado")
    return row


def tasks_today(conn: psycopg.Connection) -> int:
    row = fetch_one(
        conn,
        "select count(*) as n from public.agent_tasks "
        "where (created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date",
    )
    return int(row["n"])


def enqueue(
    conn: psycopg.Connection,
    *,
    agent_key: str,
    task_type: str,
    payload: dict[str, Any] | None = None,
    priority: int = 5,
    idempotency_key: str | None = None,
    requested_by: str = "system",
    max_attempts: int = 3,
) -> dict:
    emergency.ensure_not_stopped(conn)
    agent = _agent(conn, agent_key)
    if idempotency_key:
        existing = fetch_one(conn, "select * from public.agent_tasks where idempotency_key = %s", (idempotency_key,))
        if existing:
            return {**existing, "deduplicated": True}
    limit = load_registry()["orchestrator"].limits.get("daily_task_limit", 0)
    if limit and tasks_today(conn) >= limit:
        raise LimitExceeded(f"Limite diário de {limit} tarefas atingido")
    row = fetch_one(
        conn,
        """
        insert into public.agent_tasks (agent_id, agent_key, task_type, payload, priority, idempotency_key,
                                        requested_by, max_attempts)
        values (%s, %s, %s, %s, %s, %s, %s, %s)
        on conflict (idempotency_key) do nothing
        returning *
        """,
        (agent["id"], agent_key, task_type, Jsonb(payload or {}), priority, idempotency_key, requested_by, max_attempts),
    )
    if row is None:  # corrida com outra inserção de mesma chave
        row = fetch_one(conn, "select * from public.agent_tasks where idempotency_key = %s", (idempotency_key,))
        return {**row, "deduplicated": True}
    audit(conn, requested_by, "task.enqueued", agent_id=agent["id"], task_id=row["id"],
          details={"task_type": task_type, "priority": priority})
    return {**row, "deduplicated": False}


def claim_next(conn: psycopg.Connection, *, agent_keys: list[str] | None = None) -> dict | None:
    """Reserva a próxima tarefa (prioridade menor primeiro). Seguro com vários workers."""
    emergency.ensure_not_stopped(conn)
    filt, params = "", []
    if agent_keys:
        filt, params = "and agent_key = any(%s)", [agent_keys]
    return fetch_one(
        conn,
        f"""
        update public.agent_tasks set status = 'running', started_at = now(), attempts = attempts + 1
        where id = (
          select id from public.agent_tasks
          where status = 'queued' and scheduled_at <= now() {filt}
          order by priority asc, scheduled_at asc
          for update skip locked limit 1)
        returning *
        """,
        params,
    )


def complete(conn: psycopg.Connection, task_id: str, result: dict[str, Any]) -> dict:
    row = fetch_one(
        conn,
        "update public.agent_tasks set status = 'succeeded', result = %s, completed_at = now(), error_message = null "
        "where id = %s and status = 'running' returning *",
        (Jsonb(result), task_id),
    )
    if not row:
        raise NotFound("Tarefa não está em execução")
    audit(conn, row["agent_key"] or "worker", "task.succeeded", agent_id=row["agent_id"], task_id=row["id"])
    return row


def fail(conn: psycopg.Connection, task_id: str, error: str) -> dict:
    """Registra a falha; re-agenda com atraso exponencial enquanto houver tentativas."""
    row = fetch_one(
        conn,
        """
        update public.agent_tasks set
          status = case when attempts < max_attempts then 'queued' else 'failed' end,
          scheduled_at = case when attempts < max_attempts
                              then now() + (power(2, attempts) * interval '30 seconds') else scheduled_at end,
          completed_at = case when attempts < max_attempts then null else now() end,
          error_message = %s
        where id = %s and status = 'running' returning *
        """,
        (error[:2000], task_id),
    )
    if not row:
        raise NotFound("Tarefa não está em execução")
    audit(conn, row["agent_key"] or "worker", "task.failed", agent_id=row["agent_id"], task_id=row["id"],
          level="error" if row["status"] == "failed" else "warning",
          success=False, details={"error": error[:500], "attempts": row["attempts"], "will_retry": row["status"] == "queued"})
    return row


def cancel(conn: psycopg.Connection, task_id: str, by: str) -> dict:
    row = fetch_one(
        conn,
        "update public.agent_tasks set status = 'cancelled', completed_at = now() "
        "where id = %s and status in ('queued', 'blocked') returning *",
        (task_id,),
    )
    if not row:
        raise NotFound("Tarefa inexistente ou já em execução/finalizada")
    audit(conn, by, "task.cancelled", agent_id=row["agent_id"], task_id=row["id"])
    return row


def list_tasks(conn: psycopg.Connection, *, status: str | None = None, limit: int = 100) -> list[dict]:
    if status:
        return fetch_all(conn, "select * from public.agent_tasks where status = %s order by created_at desc limit %s",
                         (status, limit))
    return fetch_all(conn, "select * from public.agent_tasks order by created_at desc limit %s", (limit,))


def counts(conn: psycopg.Connection) -> dict:
    rows = fetch_all(conn, "select status, count(*) as n from public.agent_tasks group by status")
    out = {s: 0 for s in STATUSES}
    out.update({r["status"]: int(r["n"]) for r in rows})
    out["today"] = tasks_today(conn)
    return out
