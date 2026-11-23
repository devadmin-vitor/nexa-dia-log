"""Autenticação servidor-a-servidor.

- X-API-Key (BACKEND_API_TOKEN): somente o servidor do dashboard (Next.js) usa; o navegador nunca vê.
- X-Scheduler-Token (SCHEDULER_TOKEN): somente o n8n usa.

Em development sem token configurado a verificação é desativada (com aviso no log de inicialização);
em production a API não inicia sem tokens fortes.
"""

from __future__ import annotations

import hmac

from fastapi import Header, HTTPException, status

from core.config import get_settings


def _matches(provided: str | None, expected: str) -> bool:
    return bool(provided) and hmac.compare_digest(provided.encode(), expected.encode())


def require_api_token(x_api_key: str | None = Header(default=None)) -> str:
    expected = get_settings().backend_api_token.get_secret_value()
    if not expected:
        if get_settings().is_production:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "BACKEND_API_TOKEN não configurado")
        return "dev-operator"
    if not _matches(x_api_key, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido")
    return "operator"


def require_scheduler_token(x_scheduler_token: str | None = Header(default=None)) -> str:
    expected = get_settings().scheduler_token.get_secret_value()
    if not expected:
        if get_settings().is_production:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "SCHEDULER_TOKEN não configurado")
        return "dev-scheduler"
    if not _matches(x_scheduler_token, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token do agendador inválido")
    return "scheduler"


def validate_production_secrets() -> None:
    s = get_settings()
    if not s.is_production:
        return
    for name, value in (("BACKEND_API_TOKEN", s.backend_api_token), ("SCHEDULER_TOKEN", s.scheduler_token)):
        if len(value.get_secret_value()) < 32:
            raise RuntimeError(f"{name} deve ter ao menos 32 caracteres em produção")
