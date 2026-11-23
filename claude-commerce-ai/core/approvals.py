"""Solicitações de aprovação humana (tabela public.approvals)."""

from __future__ import annotations

from typing import Any

import psycopg

from core import emergency
from core.audit import audit
from core.db import Jsonb, fetch_all, fetch_one
from core.errors import CommerceError, Conflict, NotFound
from core.permissions import APPROVAL_ACTIONS, NEVER_AUTO_EXECUTE


def request(
    conn: psycopg.Connection,
    *,
    action_type: str,
    description: str,
    payload: dict[str, Any] | None = None,
    agent_key: str | None = None,
    task_id: str | None = None,
) -> dict:
    if action_type not in APPROVAL_ACTIONS:
        raise CommerceError(f"Ação '{action_type}' não usa o fluxo de aprovação")
    row = fetch_one(
        conn,
        "insert into public.approvals (task_id, action_type, description, payload, agent_key, risk_level) "
        "values (%s, %s, %s, %s, %s, %s) returning *",
        (task_id, action_type, description, Jsonb(payload or {}), agent_key, APPROVAL_ACTIONS[action_type]),
    )
    audit(conn, agent_key or "system", "approval.requested", task_id=task_id,
          details={"approval_id": str(row["id"]), "action_type": action_type})
    return row


def decide(conn: psycopg.Connection, approval_id: str, *, approve: bool, decided_by: str, reason: str | None) -> dict:
    emergency.ensure_not_stopped(conn)
    current = fetch_one(conn, "select * from public.approvals where id = %s for update", (approval_id,))
    if not current:
        raise NotFound("Aprovação não encontrada")
    if current["status"] != "pending":
        raise Conflict(f"Aprovação já decidida ({current['status']})")
    if approve:
        exec_status, note = "manual_required", (
            "Operação financeira: o sistema não executa pagamentos nem gastos. Faça manualmente e registre o comprovante."
            if current["action_type"] in NEVER_AUTO_EXECUTE
            else "Aprovado. Sem integração oficial autorizada para executar: realize manualmente."
        )
    else:
        exec_status, note = "cancelled", None
    row = fetch_one(
        conn,
        "update public.approvals set status = %s, decided_at = now(), decided_by = %s, decision_reason = %s, "
        "execution_status = %s, execution_note = %s where id = %s returning *",
        ("approved" if approve else "rejected", decided_by, reason, exec_status, note, approval_id),
    )
    audit(conn, decided_by, "approval." + ("approved" if approve else "rejected"),
          level="security" if current["action_type"] in NEVER_AUTO_EXECUTE else "info",
          task_id=current["task_id"], details={"approval_id": approval_id, "reason": reason})
    return row


def list_approvals(conn: psycopg.Connection, status: str | None = None) -> list[dict]:
    if status:
        return fetch_all(conn, "select * from public.approvals where status = %s order by created_at desc", (status,))
    return fetch_all(conn, "select * from public.approvals order by created_at desc limit 200")
