"""Verificação de saúde de todos os serviços locais.

Cada verificação devolve {key, name, status, detail}. status:
- ok            → serviço respondeu corretamente;
- down          → configurado, mas não respondeu;
- not_configured→ falta configuração (não é erro do serviço);
- warning       → responde, mas algo precisa de atenção.
Nenhuma verificação lança exceção; uma falha não derruba as outras.
"""

from __future__ import annotations

import shutil
import subprocess
from typing import Callable

import httpx

from core import db
from core.agent_registry import EXPECTED_AGENT_COUNT, validate_registry
from core.config import get_settings

EXPECTED_TABLES = 13


def _result(key: str, name: str, status: str, detail: str, **extra) -> dict:
    return {"key": key, "name": name, "status": status, "detail": detail, **extra}


def check_database() -> dict:
    try:
        info = db.ping()
        with db.connection() as conn:
            agents = db.fetch_one(conn, "select count(*) as n from public.agents")["n"]
            migrated = db.fetch_one(
                conn, "select count(*) as n from information_schema.columns "
                      "where table_schema='public' and table_name='products' and column_name='is_simulated'")["n"]
        tables = int(info["public_tables"])
        if not migrated:
            return _result("database", "PostgreSQL (Supabase)", "warning", "Migração 0002 não aplicada", tables=tables)
        if agents != EXPECTED_AGENT_COUNT:
            return _result("database", "PostgreSQL (Supabase)", "warning",
                           f"{agents} agentes registrados (esperado {EXPECTED_AGENT_COUNT})", tables=tables)
        return _result("database", "PostgreSQL (Supabase)", "ok",
                       f"{info['version'].split(',')[0]} · {tables} tabelas/views · {agents} agentes", tables=tables)
    except Exception as e:  # noqa: BLE001
        return _result("database", "PostgreSQL (Supabase)", "down", f"Sem conexão: {type(e).__name__}")


def check_supabase_api() -> dict:
    s = get_settings()
    try:
        r = httpx.get(f"{s.supabase_url}/auth/v1/health", timeout=3,
                      headers={"apikey": s.supabase_anon_key.get_secret_value()})
        if r.status_code == 200:
            return _result("supabase_api", "Supabase API/Auth", "ok", f"{s.supabase_url} respondeu")
        return _result("supabase_api", "Supabase API/Auth", "warning", f"HTTP {r.status_code} (verifique SUPABASE_ANON_KEY)")
    except httpx.HTTPError as e:
        return _result("supabase_api", "Supabase API/Auth", "down", f"{s.supabase_url} indisponível ({type(e).__name__})")


def check_redis() -> dict:
    try:
        import redis

        client = redis.Redis.from_url(get_settings().redis_url.get_secret_value(), socket_timeout=2, socket_connect_timeout=2)
        client.ping()
        version = client.info("server").get("redis_version")
        return _result("redis", "Redis", "ok", f"Redis {version}")
    except Exception as e:  # noqa: BLE001
        return _result("redis", "Redis", "down", f"Sem resposta ({type(e).__name__})")


def check_n8n() -> dict:
    url = get_settings().n8n_url
    try:
        r = httpx.get(f"{url}/healthz", timeout=3)
        if r.status_code == 200:
            return _result("n8n", "n8n", "ok", f"{url} respondeu")
        return _result("n8n", "n8n", "warning", f"HTTP {r.status_code}")
    except httpx.HTTPError as e:
        return _result("n8n", "n8n", "down", f"{url} indisponível ({type(e).__name__})")


def check_claude() -> dict:
    s = get_settings()
    if not s.anthropic_api_key.get_secret_value():
        return _result("claude", "Claude API", "not_configured",
                       "Desativada por decisão: análise e escrita são feitas no Claude Cowork (sem custo de API)")
    if not s.claude_model:
        return _result("claude", "Claude API", "not_configured", "CLAUDE_MODEL ausente")
    if s.usd_brl_rate <= 0:
        return _result("claude", "Claude API", "warning", "USD_BRL_RATE ausente: chamadas bloqueadas pelo controle de custos")
    return _result("claude", "Claude API", "warning",
                   f"Configurada ({s.claude_model}); não verificada — use 'Testar conexão' no painel")


def check_ffmpeg() -> dict:
    path = shutil.which("ffmpeg")
    if not path:
        return _result("ffmpeg", "FFmpeg", "not_configured", "ffmpeg não encontrado no PATH (necessário na Sprint 3)")
    try:
        out = subprocess.run([path, "-version"], capture_output=True, text=True, timeout=5).stdout.splitlines()[0]
        return _result("ffmpeg", "FFmpeg", "ok", out[:80])
    except Exception as e:  # noqa: BLE001
        return _result("ffmpeg", "FFmpeg", "warning", f"Falha ao executar ({type(e).__name__})")


def check_registry() -> dict:
    problems = validate_registry()
    if problems:
        return _result("agents_registry", "Registro de agentes", "warning", "; ".join(problems))
    return _result("agents_registry", "Registro de agentes", "ok", f"{EXPECTED_AGENT_COUNT} agentes com prompt e agent.py")


def check_tiktok() -> dict:
    from integrations.tiktok.status import status

    st = status()
    return _result("tiktok", "TikTok Shop (API oficial)", "not_configured", st["note"])


CHECKS: list[Callable[[], dict]] = [
    check_database, check_supabase_api, check_redis, check_n8n, check_claude, check_ffmpeg, check_registry, check_tiktok,
]

# Serviços sem os quais a operação local não funciona.
REQUIRED = {"database", "supabase_api", "redis", "n8n", "agents_registry"}


def run_all() -> dict:
    results = [check() for check in CHECKS]
    required_ok = all(r["status"] == "ok" for r in results if r["key"] in REQUIRED)
    return {"ok": required_ok, "services": results}
