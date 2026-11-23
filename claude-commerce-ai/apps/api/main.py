"""API do Claude Commerce AI.

Executar a partir da raiz do projeto:
    uvicorn apps.api.main:app --reload --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from apps.api.routes import health, operations
from core import agent_registry, db
from core.audit import audit
from core.config import get_settings
from core.errors import CommerceError
from core.logging import configure_logging, get_logger, log_event
from core.security import require_api_token, validate_production_secrets

log = get_logger("api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(to_file=settings.app_env != "test")
    validate_production_secrets()
    if not settings.backend_api_token.get_secret_value():
        log.warning("BACKEND_API_TOKEN ausente: autenticação desativada (apenas desenvolvimento)")
    problems = agent_registry.validate_registry()
    if problems:
        log.error("Registro de agentes inválido: %s", problems)
    db.init_pool()
    try:
        with db.connection() as conn:
            n = agent_registry.sync_agents(conn)
            audit(conn, "system", "api.startup", details={"agents_synced": n})
        log_event(log, "startup", agents_synced=n)
    except Exception as e:  # noqa: BLE001 — a API sobe mesmo sem banco; /health/services mostra o problema
        log.error("Banco indisponível na inicialização: %s", type(e).__name__)
    yield
    db.close_pool()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.project_name, version="0.2.0", lifespan=lifespan,
                  docs_url=None if settings.is_production else "/docs", redoc_url=None)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_list, allow_credentials=False,
                       allow_methods=["GET", "POST", "PATCH"], allow_headers=["Content-Type", "X-API-Key"])

    @app.exception_handler(CommerceError)
    async def _domain_error(request: Request, exc: CommerceError):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message, "error": type(exc).__name__})

    @app.middleware("http")
    async def _headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Cache-Control"] = "no-store"
        return response

    app.include_router(health.router)
    app.include_router(operations.router, prefix="/api/v1", dependencies=[Depends(require_api_token)])
    app.include_router(operations.scheduler_router, prefix="/api/v1")
    return app


app = create_app()
