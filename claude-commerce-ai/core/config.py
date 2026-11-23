"""Configuração central (lida de .env na raiz do projeto).

Segredos são SecretStr: nunca aparecem em logs, respostas da API ou no frontend.
Use `Settings.public_view()` para expor apenas o que é seguro.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # env_ignore_empty: "CHAVE=" vazio no .env usa o valor padrão em vez de falhar.
    model_config = SettingsConfigDict(env_file=ROOT_DIR / ".env", env_file_encoding="utf-8", extra="ignore",
                                      env_ignore_empty=True)

    project_name: str = "Claude Commerce AI"
    brand_name: str = "BRAND_NAME"
    app_env: str = "development"  # development | test | production

    # Autenticação servidor-a-servidor
    backend_api_token: SecretStr = SecretStr("")
    scheduler_token: SecretStr = SecretStr("")
    cors_origins: str = "http://localhost:3000"

    # Claude API — o modelo é configurável, sem versão fixa no código.
    anthropic_api_key: SecretStr = SecretStr("")
    claude_model: str = ""
    claude_effort: str = "medium"
    claude_max_tokens: int = Field(default=8000, ge=256, le=128000)
    claude_use_fallbacks: bool = True

    # Custos (orçamento em BRL; a API cobra em USD)
    usd_brl_rate: float = Field(default=0.0, ge=0)
    monthly_budget_brl: float = Field(default=150.0, ge=0)
    daily_api_budget_brl: float = Field(default=4.0, ge=0)

    # Serviços locais
    database_url: SecretStr = SecretStr("postgresql://postgres:postgres@127.0.0.1:54322/postgres")
    supabase_url: str = "http://127.0.0.1:54321"
    supabase_anon_key: SecretStr = SecretStr("")
    supabase_service_role_key: SecretStr = SecretStr("")
    redis_url: SecretStr = SecretStr("redis://localhost:6379/0")
    n8n_url: str = "http://127.0.0.1:5678"

    # TikTok Shop (somente após aprovação; conector ainda não implementado)
    tiktok_shop_app_key: SecretStr = SecretStr("")
    tiktok_shop_app_secret: SecretStr = SecretStr("")

    # Emergência: true força a parada desde a inicialização
    emergency_stop: bool = False

    @field_validator("app_env")
    @classmethod
    def _env(cls, v: str) -> str:
        v = v.lower().strip()
        if v not in {"development", "test", "production"}:
            raise ValueError("APP_ENV deve ser development, test ou production")
        return v

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def claude_configured(self) -> bool:
        return bool(self.anthropic_api_key.get_secret_value()) and bool(self.claude_model)

    def public_view(self) -> dict:
        return {
            "project_name": self.project_name,
            "brand_name": self.brand_name,
            "app_env": self.app_env,
            "claude_model": self.claude_model or None,
            "claude_effort": self.claude_effort,
            "anthropic_api_key_configured": bool(self.anthropic_api_key.get_secret_value()),
            "usd_brl_rate_configured": self.usd_brl_rate > 0,
            "monthly_budget_brl": self.monthly_budget_brl,
            "daily_api_budget_brl": self.daily_api_budget_brl,
            "supabase_url": self.supabase_url,
            "n8n_url": self.n8n_url,
            "tiktok_credentials_present": bool(self.tiktok_shop_app_key.get_secret_value())
            and bool(self.tiktok_shop_app_secret.get_secret_value()),
            "emergency_stop_env": self.emergency_stop,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
