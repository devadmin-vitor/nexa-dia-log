"""Parada de emergência.

Ativa se EMERGENCY_STOP=true no .env OU se app_settings.emergency_stop.active = true.
Quando ativa: chamadas à Claude API, criação/execução de tarefas, disparos do agendador
e decisões de aprovação são bloqueados (HTTP 423).
"""

from __future__ import annotations

from datetime import datetime, timezone

import psycopg

from core.audit import audit
from core.config import get_settings
from core.db import Jsonb, fetch_one
from core.errors import EmergencyStopActive


def status(conn: psycopg.Connection) -> dict:
    row = fetch_one(conn, "select value from public.app_settings where key = 'emergency_stop'")
    value = (row or {}).get("value") or {}
    env_forced = get_settings().emergency_stop
    return {
        "active": bool(value.get("active")) or env_forced,
        "forced_by_env": env_forced,
        "reason": "EMERGENCY_STOP=true no .env" if env_forced and not value.get("active") else value.get("reason"),
        "changed_by": value.get("changed_by"),
        "changed_at": value.get("changed_at"),
    }


def ensure_not_stopped(conn: psycopg.Connection) -> None:
    st = status(conn)
    if st["active"]:
        raise EmergencyStopActive(f"Parada de emergência ativa: {st['reason']}")


def set_stop(conn: psycopg.Connection, *, active: bool, reason: str, changed_by: str) -> dict:
    value = {
        "active": active,
        "reason": reason if active else None,
        "changed_by": changed_by,
        "changed_at": datetime.now(timezone.utc).isoformat(),
    }
    conn.execute(
        "insert into public.app_settings (key, value) values ('emergency_stop', %s) "
        "on conflict (key) do update set value = excluded.value",
        (Jsonb(value),),
    )
    if active:
        # Interrompe imediatamente as tarefas pendentes/em execução.
        conn.execute(
            "update public.agent_tasks set status = 'blocked', error_message = 'Parada de emergência', "
            "completed_at = now() where status in ('queued', 'running')"
        )
    audit(conn, changed_by, "emergency_stop." + ("on" if active else "off"), level="security", details={"reason": reason})
    return status(conn)
