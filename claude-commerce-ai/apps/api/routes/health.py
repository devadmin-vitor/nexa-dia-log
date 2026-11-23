from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from core import health
from core.config import get_settings
from core.security import require_api_token

router = APIRouter(tags=["health"])


@router.get("/health")
def liveness():
    """Público e sem detalhes: o processo da API está no ar."""
    return {"status": "online", "project": "claude-commerce-ai"}


@router.get("/health/services", dependencies=[Depends(require_api_token)])
def services():
    """Saúde de todos os serviços. 200 se os obrigatórios estiverem ok, 503 caso contrário."""
    result = health.run_all()
    result["project"] = get_settings().project_name
    return JSONResponse(status_code=200 if result["ok"] else 503, content=result)
