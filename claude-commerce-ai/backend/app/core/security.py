"""Autenticação servidor-a-servidor.

- `require_api_token`: protege a API. O token fica apenas no servidor Next.js (nunca no browser).
- `require_scheduler_token`: token separado para o n8n/agendador.

Em `development` sem token configurado a verificação é desativada com aviso no log;
em `production` a aplicação recusa iniciar sem tokens (ver main.py).
"""

from __future__ import annotations

import hmac

from fastapi import Header, HTTPException, status

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)


def _matches(provided: str | None, expected: str) -> bool:
    return bool(provided) and hmac.compare_digest(provided.encode(), expected.encode())


def require_api_token(x_api_key: str | None = Header(default=None)) -> str:
    settings = get_settings()
    if not settings.backend_api_token:
        if settings.is_production:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "API token não configurado")
        return "dev-anonymous"
    if not _matches(x_api_key, settings.backend_api_token):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido")
    return "operator"


def require_scheduler_token(x_scheduler_token: str | None = Header(default=None)) -> str:
    settings = get_settings()
    if not settings.scheduler_token:
        if settings.is_production:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Scheduler token não configurado")
        return "scheduler-dev"
    if not _matches(x_scheduler_token, settings.scheduler_token):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token do agendador inválido")
    return "scheduler"
