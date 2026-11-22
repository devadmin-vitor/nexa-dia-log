"""Configuração central lida do ambiente.

Credenciais nunca são enviadas ao frontend nem gravadas em logs. Use `Settings.public_view()`
para expor somente o que é seguro (ex.: "configurado: sim/não").
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache


def _bool(value: str | None, default: bool = False) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "sim", "on"}


def _float(value: str | None, default: float) -> float:
    try:
        return float(value) if value not in (None, "") else default
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    env: str = "development"
    # Autenticação entre frontend (servidor Next.js) e backend.
    backend_api_token: str = ""
    # Token exclusivo para o n8n / agendador disparar tarefas.
    scheduler_token: str = ""
    cors_origins: tuple[str, ...] = ("http://localhost:3000",)

    # IA
    anthropic_api_key_present: bool = False
    ai_mode: str = "auto"  # auto | live | simulated
    claude_model: str = "claude-opus-5-5"
    claude_effort: str = "medium"
    claude_use_fallbacks: bool = True
    daily_ai_budget_usd: float = 5.0
    per_run_max_tokens: int = 8000

    # Supabase (Fase 2 — persistência). Somente presença é exposta.
    supabase_url: str = ""
    supabase_service_role_key_present: bool = False

    # TikTok Shop (depende de aprovação no Partner Center).
    tiktok_app_key_present: bool = False
    tiktok_app_secret_present: bool = False

    kill_switch_on_boot: bool = False
    seed_simulated_data: bool = True

    extra: dict = field(default_factory=dict)

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def ai_live_enabled(self) -> bool:
        if self.ai_mode == "simulated":
            return False
        return self.anthropic_api_key_present

    def public_view(self) -> dict:
        return {
            "env": self.env,
            "ai_mode_configured": self.ai_mode,
            "ai_live_enabled": self.ai_live_enabled,
            "claude_model": self.claude_model,
            "claude_effort": self.claude_effort,
            "daily_ai_budget_usd": self.daily_ai_budget_usd,
            "anthropic_api_key_configured": self.anthropic_api_key_present,
            "supabase_configured": bool(self.supabase_url) and self.supabase_service_role_key_present,
            "tiktok_credentials_present": self.tiktok_app_key_present and self.tiktok_app_secret_present,
            "scheduler_token_configured": bool(self.scheduler_token),
        }


def load_settings() -> Settings:
    e = os.environ
    origins = tuple(
        o.strip() for o in e.get("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()
    )
    return Settings(
        env=e.get("APP_ENV", "development"),
        backend_api_token=e.get("BACKEND_API_TOKEN", ""),
        scheduler_token=e.get("SCHEDULER_TOKEN", ""),
        cors_origins=origins,
        anthropic_api_key_present=bool(e.get("ANTHROPIC_API_KEY")),
        ai_mode=e.get("AI_MODE", "auto").lower(),
        claude_model=e.get("CLAUDE_MODEL", "claude-opus-5-5"),
        claude_effort=e.get("CLAUDE_EFFORT", "medium"),
        claude_use_fallbacks=_bool(e.get("CLAUDE_USE_FALLBACKS"), True),
        daily_ai_budget_usd=_float(e.get("DAILY_AI_BUDGET_USD"), 5.0),
        per_run_max_tokens=int(_float(e.get("PER_RUN_MAX_TOKENS"), 8000)),
        supabase_url=e.get("SUPABASE_URL", ""),
        supabase_service_role_key_present=bool(e.get("SUPABASE_SERVICE_ROLE_KEY")),
        tiktok_app_key_present=bool(e.get("TIKTOK_SHOP_APP_KEY")),
        tiktok_app_secret_present=bool(e.get("TIKTOK_SHOP_APP_SECRET")),
        kill_switch_on_boot=_bool(e.get("KILL_SWITCH"), False),
        seed_simulated_data=_bool(e.get("SEED_SIMULATED_DATA"), True),
    )


@lru_cache
def get_settings() -> Settings:
    return load_settings()
