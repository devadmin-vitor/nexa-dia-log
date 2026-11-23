"""Registro de auditoria (tabela audit_logs, somente-inserção)."""

from __future__ import annotations

from typing import Any

import psycopg

from core.db import Jsonb, fetch_all
from core.logging import get_logger, mask_secrets

log = get_logger(__name__)


def _clean(details: dict[str, Any] | None) -> dict[str, Any]:
    # Garante que nenhum segredo vá parar na auditoria.
    return {k: mask_secrets(str(v)) if isinstance(v, str) else v for k, v in (details or {}).items()}


def audit(
    conn: psycopg.Connection,
    actor: str,
    action: str,
    *,
    details: dict[str, Any] | None = None,
    level: str = "info",
    success: bool = True,
    agent_id: str | None = None,
    task_id: str | None = None,
) -> None:
    conn.execute(
        "insert into public.audit_logs (actor, action, details, level, success, agent_id, task_id) "
        "values (%s, %s, %s, %s, %s, %s, %s)",
        (actor, action, Jsonb(_clean(details)), level, success, agent_id, task_id),
    )


def recent(conn: psycopg.Connection, limit: int = 200, level: str | None = None) -> list[dict]:
    if level:
        return fetch_all(
            conn,
            "select l.*, a.agent_key from public.audit_logs l left join public.agents a on a.id = l.agent_id "
            "where l.level = %s order by l.created_at desc limit %s",
            (level, limit),
        )
    return fetch_all(
        conn,
        "select l.*, a.agent_key from public.audit_logs l left join public.agents a on a.id = l.agent_id "
        "order by l.created_at desc limit %s",
        (limit,),
    )
