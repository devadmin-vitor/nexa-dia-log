"""Fixtures de teste.

- Testes unitários não precisam de serviços.
- Testes de integração criam um banco temporário, aplicam supabase/migrations + seed e o removem no fim.
  Requerem TEST_DATABASE_URL (superusuário), por exemplo o Supabase local:
      TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:44322/postgres
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent

# Ambiente determinístico para os testes (não lê o .env do operador).
os.environ.update({
    "APP_ENV": "test",
    "BACKEND_API_TOKEN": "test-api-token",
    "SCHEDULER_TOKEN": "test-scheduler-token",
    "ANTHROPIC_API_KEY": "",
    "CLAUDE_MODEL": "claude-opus-5-5",
    "USD_BRL_RATE": "5.0",
    "DAILY_API_BUDGET_BRL": "1.0",
    "MONTHLY_BUDGET_BRL": "150",
    "EMERGENCY_STOP": "false",
    "REDIS_URL": "redis://localhost:1/0",       # porta inválida: health deve reportar 'down' sem quebrar
    "N8N_URL": "http://127.0.0.1:1",
    "SUPABASE_URL": "http://127.0.0.1:1",
})

AUTH = {"X-API-Key": "test-api-token"}
SCHED = {"X-Scheduler-Token": "test-scheduler-token"}


def _reset_caches():
    from core import db
    from core.agent_registry import load_registry
    from core.config import get_settings

    db.close_pool()
    get_settings.cache_clear()
    load_registry.cache_clear()


@pytest.fixture(autouse=True)
def _fresh_settings():
    _reset_caches()
    yield
    _reset_caches()


def _apply_sql(conninfo: str) -> None:
    import psycopg

    with psycopg.connect(conninfo, autocommit=True) as conn:
        for f in sorted((ROOT / "supabase" / "migrations").glob("*.sql")):
            conn.execute(f.read_text(encoding="utf-8"))
        conn.execute((ROOT / "supabase" / "seed.sql").read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def database_url():
    admin = os.environ.get("TEST_DATABASE_URL")
    if not admin:
        pytest.skip("TEST_DATABASE_URL não definido (testes de integração pulados)")
    import psycopg
    from psycopg.conninfo import conninfo_to_dict, make_conninfo

    name = f"cca_test_{uuid.uuid4().hex[:8]}"
    try:
        with psycopg.connect(admin, autocommit=True, connect_timeout=3) as conn:
            conn.execute(f'create database "{name}"')
    except psycopg.OperationalError as e:
        pytest.skip(f"PostgreSQL indisponível: {e}")
    url = make_conninfo(**{**conninfo_to_dict(admin), "dbname": name})
    _apply_sql(url)
    yield url
    from core import db

    db.close_pool()
    with psycopg.connect(admin, autocommit=True) as conn:
        conn.execute(f'drop database if exists "{name}" with (force)')


@pytest.fixture
def db_env(database_url, monkeypatch):
    """Banco limpo por teste (tabelas de negócio truncadas) + agentes sincronizados."""
    import psycopg

    monkeypatch.setenv("DATABASE_URL", database_url)
    _reset_caches()
    with psycopg.connect(database_url, autocommit=True) as conn:
        conn.execute("alter table public.audit_logs disable trigger trg_audit_append_only")
        conn.execute(
            "truncate public.audit_logs, public.cost_usage, public.commissions, public.affiliate_orders, "
            "public.content_metrics, public.publications, public.approvals, public.agent_tasks, "
            "public.content_ideas, public.product_metrics, public.products, public.agents cascade"
        )
        conn.execute("alter table public.audit_logs enable trigger trg_audit_append_only")
        conn.execute("update public.app_settings set value = '{\"active\": false}' where key = 'emergency_stop'")
    from core import agent_registry, db

    with db.connection() as conn:
        agent_registry.sync_agents(conn)
    yield database_url


@pytest.fixture
def conn(db_env):
    from core import db

    with db.connection() as c:
        yield c


@pytest.fixture
def client(db_env):
    from fastapi.testclient import TestClient

    from apps.api.main import create_app

    with TestClient(create_app()) as c:
        yield c
