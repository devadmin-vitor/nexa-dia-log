from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import catalog, dashboard, operations
from app.core.config import get_settings
from app.core.errors import CommerceError
from app.core.logging import configure_logging, get_logger
from app.core.security import require_api_token
from app.domain.models import LogLevel
from app.store.memory import get_store
from app.store.seed import seed_simulated

log = get_logger("app")


def _validate_production(settings) -> None:
    if settings.is_production:
        missing = [n for n, v in (("BACKEND_API_TOKEN", settings.backend_api_token), ("SCHEDULER_TOKEN", settings.scheduler_token)) if not v]
        if missing:
            raise RuntimeError(f"Produção exige: {', '.join(missing)}")
        if len(settings.backend_api_token) < 32 or len(settings.scheduler_token) < 32:
            raise RuntimeError("Tokens de produção devem ter ao menos 32 caracteres")


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    settings = get_settings()
    _validate_production(settings)
    store = get_store()
    if settings.seed_simulated_data and not store.products:
        seed_simulated(store)
    if settings.kill_switch_on_boot:
        store.system.kill_switch_active = True
        store.system.kill_switch_reason = "KILL_SWITCH=1 no ambiente"
    if not settings.backend_api_token:
        log.warning("BACKEND_API_TOKEN ausente: autenticação desativada (somente desenvolvimento)")
    log.info("startup", extra={"extra_fields": settings.public_view()})
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Claude Commerce AI", version="0.1.0", lifespan=lifespan,
                  docs_url=None if settings.is_production else "/docs", redoc_url=None)
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_credentials=False,
                       allow_methods=["GET", "POST", "PATCH"], allow_headers=["Content-Type", "X-API-Key"])

    @app.exception_handler(CommerceError)
    async def _domain_error(request: Request, exc: CommerceError):
        get_store().log("system", "api.domain_error", level=LogLevel.warning,
                        details={"path": request.url.path, "error": exc.message, "type": type(exc).__name__})
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message, "error": type(exc).__name__})

    @app.middleware("http")
    async def _security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/health", tags=["health"])
    def health():
        store = get_store()
        return {"status": "ok", "kill_switch_active": store.system.kill_switch_active}

    protected = [Depends(require_api_token)]
    for r in (dashboard.router, catalog.router, operations.router):
        app.include_router(r, prefix="/api/v1", dependencies=protected)
    # Agendador usa token próprio (n8n); não usa o token do frontend.
    app.include_router(operations.scheduler_router, prefix="/api/v1")
    return app


app = create_app()
